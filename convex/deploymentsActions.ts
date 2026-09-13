import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/** Workers Free plan daily request limit (resets midnight UTC). */
const WORKERS_FREE_REQUESTS_PER_DAY = 100_000;

type CfApiEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: T;
};

type CfWorkerScript = {
  id: string;
  tag?: string;
};

type CfBuildTriggerMeta = {
  author?: string;
  branch?: string;
  commit_hash?: string;
  commit_message?: string;
  trigger_name?: string;
};

type CfBuild = {
  build_uuid?: string;
  status?: string;
  build_outcome?: string;
  created_on?: string;
  stopped_on?: string;
  build_trigger_metadata?: CfBuildTriggerMeta;
  trigger?: {
    trigger_name?: string;
    branch_includes?: string[];
  };
};

type CfBuildLimits = {
  build_minutes_refresh_on?: string;
  has_reached_build_minutes_limit?: boolean;
};

type DeployTarget = {
  workerName: string;
  displayName: string;
  accountId: string;
  siteId?: Id<"sites">;
};

type AccountUsage = {
  requestsToday: number | null;
  buildMinutesLimitReached: boolean | null;
  buildMinutesRefreshOn: number | null;
  usageError?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

function dashboardUrl(accountId: string, workerName: string): string {
  return `https://dash.cloudflare.com/${accountId}/workers/services/view/${encodeURIComponent(workerName)}/production`;
}

function utcDayBounds(now = new Date()): { start: string; end: string } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

function pickPreferredBuild(builds: CfBuild[]): CfBuild | null {
  if (builds.length === 0) return null;

  const productionPreferred = builds.find((b) => {
    const branch = b.build_trigger_metadata?.branch?.toLowerCase();
    const triggerName = (
      b.trigger?.trigger_name ??
      b.build_trigger_metadata?.trigger_name ??
      ""
    ).toLowerCase();
    const branches = b.trigger?.branch_includes ?? [];
    if (branch === "main" || branch === "master") return true;
    if (triggerName.includes("production")) return true;
    if (branches.includes("main") || branches.includes("master")) return true;
    return false;
  });

  return productionPreferred ?? builds[0];
}

async function cfGet<T>(
  path: string,
  accountId: string,
  token: string
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  let body: CfApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as CfApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (!res.ok || !body?.success) {
    const message =
      body?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `Cloudflare API error (${res.status})`;
    return { ok: false, error: message };
  }

  return { ok: true, data: body.result as T };
}

async function listWorkerTags(
  accountId: string,
  token: string
): Promise<{ ok: true; map: Map<string, string> } | { ok: false; error: string }> {
  const result = await cfGet<CfWorkerScript[]>(
    "/workers/scripts",
    accountId,
    token
  );
  if (!result.ok) return result;

  const map = new Map<string, string>();
  for (const script of result.data ?? []) {
    if (script.id && script.tag) {
      map.set(script.id, script.tag);
    }
  }
  return { ok: true, map };
}

async function fetchLatestBuild(
  accountId: string,
  token: string,
  workerTag: string
): Promise<{ ok: true; build: CfBuild | null } | { ok: false; error: string }> {
  const result = await cfGet<CfBuild[] | { builds?: CfBuild[] }>(
    `/builds/workers/${workerTag}/builds`,
    accountId,
    token
  );
  if (!result.ok) return result;

  const raw = result.data;
  const builds = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.builds)
      ? raw.builds
      : [];
  return { ok: true, build: pickPreferredBuild(builds) };
}

async function fetchBuildLimits(
  accountId: string,
  token: string
): Promise<{
  ok: true;
  limitReached: boolean | null;
  refreshOn: number | null;
} | { ok: false; error: string }> {
  const result = await cfGet<CfBuildLimits>(
    "/builds/account/limits",
    accountId,
    token
  );
  if (!result.ok) return result;
  return {
    ok: true,
    limitReached:
      typeof result.data?.has_reached_build_minutes_limit === "boolean"
        ? result.data.has_reached_build_minutes_limit
        : null,
    refreshOn: parseTime(result.data?.build_minutes_refresh_on) ?? null,
  };
}

async function fetchRequestsToday(
  accountId: string,
  token: string,
  scriptName: string
): Promise<{ ok: true; requests: number } | { ok: false; error: string }> {
  const { start, end } = utcDayBounds();
  const query = `
    query WorkersRequestsToday(
      $accountTag: string!
      $scriptName: string!
      $datetimeStart: string!
      $datetimeEnd: string!
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 1000
            filter: {
              scriptName: $scriptName
              datetime_geq: $datetimeStart
              datetime_leq: $datetimeEnd
            }
          ) {
            sum { requests }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        accountTag: accountId,
        scriptName,
        datetimeStart: start,
        datetimeEnd: end,
      },
    }),
  });

  const body = (await res.json()) as {
    errors?: Array<{ message?: string }>;
    data?: {
      viewer?: {
        accounts?: Array<{
          workersInvocationsAdaptive?: Array<{
            sum?: { requests?: number };
          }>;
        }>;
      };
    };
  };

  if (!res.ok || body.errors?.length) {
    const message =
      body.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `GraphQL error (${res.status})`;
    return { ok: false, error: message };
  }

  const rows =
    body.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  let total = 0;
  for (const row of rows) {
    total += row.sum?.requests ?? 0;
  }
  return { ok: true, requests: total };
}

async function fetchAccountUsage(
  accountId: string,
  token: string,
  workerName: string
): Promise<AccountUsage> {
  const [limits, requests] = await Promise.all([
    fetchBuildLimits(accountId, token),
    fetchRequestsToday(accountId, token, workerName),
  ]);

  const usageErrors: string[] = [];
  if (!limits.ok) usageErrors.push(`builds: ${limits.error}`);
  if (!requests.ok) usageErrors.push(`requests: ${requests.error}`);

  return {
    requestsToday: requests.ok ? requests.requests : null,
    buildMinutesLimitReached: limits.ok ? limits.limitReached : null,
    buildMinutesRefreshOn: limits.ok ? limits.refreshOn : null,
    ...(usageErrors.length > 0
      ? { usageError: usageErrors.join("; ") }
      : {}),
  };
}

export const syncAllInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    ok: boolean;
    error: string | null;
    workers: number;
  }> => {
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
    const bookingBroomAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

    if (!token) {
      const message =
        "Missing CLOUDFLARE_API_TOKEN in Convex env. Create a user-scoped API token " +
        "with Workers Builds Configuration (Read), Workers Scripts (Read), and " +
        "Account Analytics (Read). The same Cloudflare user must be a member of every site account.";
      await ctx.runMutation(internal.deployments.setSyncResult, {
        error: message,
      });
      return { ok: false, error: message, workers: 0 };
    }

    const targetsPayload: {
      bookingBroom: { workerName: string; displayName: string };
      sites: Array<{
        _id: Id<"sites">;
        slug: string;
        name: string;
        cloudflareWorkerName?: string;
        cloudflareAccountId?: string;
      }>;
    } = await ctx.runQuery(internal.deployments.listTargetsInternal, {});

    const targets: DeployTarget[] = [];
    const missingAccount: string[] = [];

    if (bookingBroomAccountId) {
      targets.push({
        workerName: targetsPayload.bookingBroom.workerName,
        displayName: targetsPayload.bookingBroom.displayName,
        accountId: bookingBroomAccountId,
      });
    } else {
      missingAccount.push("booking-broom (set CLOUDFLARE_ACCOUNT_ID)");
      await ctx.runMutation(internal.deployments.upsertStatus, {
        workerName: targetsPayload.bookingBroom.workerName,
        displayName: targetsPayload.bookingBroom.displayName,
        error:
          "Missing CLOUDFLARE_ACCOUNT_ID in Convex env for Booking Broom",
      });
    }

    for (const site of targetsPayload.sites) {
      if (!site.cloudflareWorkerName) continue;
      if (!site.cloudflareAccountId?.trim()) {
        missingAccount.push(site.slug);
        await ctx.runMutation(internal.deployments.upsertStatus, {
          workerName: site.cloudflareWorkerName,
          siteId: site._id,
          displayName: site.name,
          error:
            "Set Cloudflare Account ID on this card (Deploys) — each site has its own CF account",
        });
        continue;
      }
      targets.push({
        workerName: site.cloudflareWorkerName,
        displayName: site.name,
        accountId: site.cloudflareAccountId.trim(),
        siteId: site._id,
      });
    }

    const errors: string[] = [];
    if (missingAccount.length > 0) {
      errors.push(
        `Missing Account ID: ${missingAccount.slice(0, 5).join(", ")}${
          missingAccount.length > 5
            ? ` (+${missingAccount.length - 5} more)`
            : ""
        }`
      );
    }

    // Cache Worker tags + usage per account (each site is typically its own account).
    const tagsByAccount = new Map<string, Map<string, string>>();
    const usageByKey = new Map<string, AccountUsage>();

    for (const target of targets) {
      const dash = dashboardUrl(target.accountId, target.workerName);

      try {
        let tagMap = tagsByAccount.get(target.accountId);
        if (!tagMap) {
          const tagsResult = await listWorkerTags(target.accountId, token);
          if (!tagsResult.ok) {
            errors.push(`${target.workerName}: ${tagsResult.error}`);
            await ctx.runMutation(internal.deployments.upsertStatus, {
              workerName: target.workerName,
              siteId: target.siteId,
              displayName: target.displayName,
              accountId: target.accountId,
              dashboardUrl: dash,
              error: tagsResult.error,
            });
            continue;
          }
          tagMap = tagsResult.map;
          tagsByAccount.set(target.accountId, tagMap);
        }

        const tag = tagMap.get(target.workerName);
        if (!tag) {
          const message = `Worker "${target.workerName}" not found in account ${target.accountId}`;
          errors.push(`${target.workerName}: ${message}`);
          await ctx.runMutation(internal.deployments.upsertStatus, {
            workerName: target.workerName,
            siteId: target.siteId,
            displayName: target.displayName,
            accountId: target.accountId,
            dashboardUrl: dash,
            error: message,
          });
          continue;
        }

        const usageKey = `${target.accountId}:${target.workerName}`;
        let usage = usageByKey.get(usageKey);
        if (!usage) {
          usage = await fetchAccountUsage(
            target.accountId,
            token,
            target.workerName
          );
          usageByKey.set(usageKey, usage);
        }

        const buildResult = await fetchLatestBuild(
          target.accountId,
          token,
          tag
        );
        if (!buildResult.ok) {
          errors.push(`${target.workerName}: ${buildResult.error}`);
          await ctx.runMutation(internal.deployments.upsertStatus, {
            workerName: target.workerName,
            siteId: target.siteId,
            displayName: target.displayName,
            accountId: target.accountId,
            dashboardUrl: dash,
            requestsToday: usage.requestsToday,
            requestsLimit: WORKERS_FREE_REQUESTS_PER_DAY,
            buildMinutesLimitReached: usage.buildMinutesLimitReached,
            buildMinutesRefreshOn: usage.buildMinutesRefreshOn,
            error: buildResult.error,
          });
          continue;
        }

        const build = buildResult.build;
        if (!build) {
          const message =
            "No builds found — connect Workers Builds (Git) for this Worker";
          errors.push(`${target.workerName}: ${message}`);
          await ctx.runMutation(internal.deployments.upsertStatus, {
            workerName: target.workerName,
            siteId: target.siteId,
            displayName: target.displayName,
            accountId: target.accountId,
            dashboardUrl: dash,
            requestsToday: usage.requestsToday,
            requestsLimit: WORKERS_FREE_REQUESTS_PER_DAY,
            buildMinutesLimitReached: usage.buildMinutesLimitReached,
            buildMinutesRefreshOn: usage.buildMinutesRefreshOn,
            error: message,
          });
          continue;
        }

        const meta = build.build_trigger_metadata;
        const combinedError = usage.usageError ?? null;
        if (combinedError) {
          errors.push(`${target.workerName}: usage ${combinedError}`);
        }

        await ctx.runMutation(internal.deployments.upsertStatus, {
          workerName: target.workerName,
          siteId: target.siteId,
          displayName: target.displayName,
          accountId: target.accountId,
          status: build.status ?? null,
          buildOutcome: build.build_outcome ?? null,
          branch: meta?.branch ?? null,
          commitHash: meta?.commit_hash ?? null,
          commitMessage: meta?.commit_message ?? null,
          author: meta?.author ?? null,
          createdOn: parseTime(build.created_on) ?? null,
          stoppedOn: parseTime(build.stopped_on) ?? null,
          buildUuid: build.build_uuid ?? null,
          dashboardUrl: dash,
          requestsToday: usage.requestsToday,
          requestsLimit: WORKERS_FREE_REQUESTS_PER_DAY,
          buildMinutesLimitReached: usage.buildMinutesLimitReached,
          buildMinutesRefreshOn: usage.buildMinutesRefreshOn,
          error: null,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Workers Builds sync failed";
        errors.push(`${target.workerName}: ${message}`);
        await ctx.runMutation(internal.deployments.upsertStatus, {
          workerName: target.workerName,
          siteId: target.siteId,
          displayName: target.displayName,
          accountId: target.accountId,
          dashboardUrl: dash,
          error: message,
        });
      }

      await sleep(200);
    }

    const summary =
      errors.length > 0
        ? errors.slice(0, 5).join("; ") +
          (errors.length > 5 ? ` (+${errors.length - 5} more)` : "")
        : null;

    await ctx.runMutation(internal.deployments.setSyncResult, {
      error: summary,
    });

    return {
      ok: errors.length === 0,
      error: summary,
      workers: targets.length,
    };
  },
});

export const syncNow = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ ok: boolean; error: string | null; workers: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const result: { ok: boolean; error: string | null; workers: number } =
      await ctx.runAction(internal.deploymentsActions.syncAllInternal, {});

    if (!result.ok && result.error) {
      const fatal =
        result.error.includes("CLOUDFLARE_API_TOKEN") ||
        result.error.toLowerCase().includes("invalid token") ||
        result.error.toLowerCase().includes("authentication");
      if (fatal) {
        throw new Error(result.error);
      }
    }
    return result;
  },
});
