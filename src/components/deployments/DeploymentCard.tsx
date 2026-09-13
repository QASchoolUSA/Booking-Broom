"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowSquareOut } from "@phosphor-icons/react";
import type { DeploymentRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DeploymentCardProps {
  row: DeploymentRow;
}

function shortSha(hash: string | null): string | null {
  if (!hash) return null;
  return hash.slice(0, 7);
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function statusLabel(row: DeploymentRow): {
  label: string;
  className: string;
} {
  if (!row.target.worker_name) {
    return {
      label: "Not on Cloudflare",
      className: "bg-muted text-muted-foreground border-border",
    };
  }

  const d = row.deployment;
  if (!d) {
    return {
      label: "Not synced",
      className: "bg-muted text-muted-foreground border-border",
    };
  }
  if (d.error && !d.build_uuid) {
    return {
      label: "Error",
      className:
        "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    };
  }

  const status = (d.status ?? "").toLowerCase();
  if (
    status === "queued" ||
    status === "initializing" ||
    status === "running"
  ) {
    return {
      label: status === "running" ? "Building" : status,
      className:
        "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
    };
  }

  const outcome = (d.build_outcome ?? "").toLowerCase();
  if (outcome === "success") {
    return {
      label: "Success",
      className:
        "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    };
  }
  if (outcome === "fail") {
    return {
      label: "Failed",
      className:
        "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    };
  }
  if (outcome === "cancelled" || outcome === "terminated") {
    return {
      label: outcome === "cancelled" ? "Cancelled" : "Terminated",
      className:
        "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    };
  }
  if (outcome === "skipped") {
    return {
      label: "Skipped",
      className: "bg-muted text-muted-foreground border-border",
    };
  }

  return {
    label: d.status ?? "Unknown",
    className: "bg-muted text-muted-foreground border-border",
  };
}

function UsageMeter({
  used,
  limit,
  remaining,
}: {
  used: number;
  limit: number;
  remaining: number;
}) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Free requests today</span>
        <span className="tabular-nums text-foreground">
          {formatCount(remaining)} left · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {formatCount(used)} / {formatCount(limit)} (resets midnight UTC)
      </p>
    </div>
  );
}

export function DeploymentCard({ row }: DeploymentCardProps) {
  const { target, deployment } = row;
  const updateAccountId = useMutation(api.deployments.updateCloudflareAccountId);
  const [accountId, setAccountId] = useState(
    target.cloudflare_account_id ?? ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccountId(target.cloudflare_account_id ?? "");
  }, [target.cloudflare_account_id]);

  const pill = statusLabel(row);
  const sha = shortSha(deployment?.commit_hash ?? null);
  const when =
    deployment?.stopped_on ?? deployment?.created_on ?? deployment?.checked_at;
  const whenLabel = when
    ? formatDistanceToNow(new Date(when), { addSuffix: true })
    : null;

  const handleSaveAccountId = async () => {
    if (!target.site_id) return;
    setSaving(true);
    try {
      await updateAccountId({
        siteId: target.site_id as Id<"sites">,
        cloudflareAccountId: accountId.trim() || null,
      });
      toast.success("Cloudflare Account ID saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save Account ID");
    } finally {
      setSaving(false);
    }
  };

  const showUsage =
    deployment?.requests_today != null &&
    deployment.requests_remaining != null;

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: target.accent_color }}
              aria-hidden
            />
            <h3 className="truncate text-sm font-semibold text-foreground">
              {target.name}
            </h3>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {target.worker_name ?? "—"}
            {target.domain ? ` · ${target.domain}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize",
            pill.className
          )}
        >
          {pill.label}
        </span>
      </div>

      {deployment?.error && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {deployment.error}
        </p>
      )}

      {showUsage && (
        <UsageMeter
          used={deployment.requests_today!}
          limit={deployment.requests_limit}
          remaining={deployment.requests_remaining!}
        />
      )}

      {deployment?.build_minutes_limit_reached != null && (
        <p
          className={cn(
            "text-xs",
            deployment.build_minutes_limit_reached
              ? "text-red-700 dark:text-red-400"
              : "text-muted-foreground"
          )}
        >
          Builds minutes:{" "}
          {deployment.build_minutes_limit_reached
            ? "Free limit reached"
            : "OK (under free monthly minutes)"}
          {deployment.build_minutes_refresh_on
            ? ` · refreshes ${formatDistanceToNow(
                new Date(deployment.build_minutes_refresh_on),
                { addSuffix: true }
              )}`
            : ""}
        </p>
      )}

      {target.worker_name && deployment && !deployment.error && (
        <dl className="grid gap-1.5 text-xs">
          {(deployment.branch || sha) && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Commit</dt>
              <dd className="truncate font-mono text-foreground">
                {deployment.branch ?? "—"}
                {sha ? ` @ ${sha}` : ""}
              </dd>
            </div>
          )}
          {deployment.commit_message && (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-muted-foreground">Message</dt>
              <dd className="truncate text-right text-foreground">
                {deployment.commit_message}
              </dd>
            </div>
          )}
          {deployment.author && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Author</dt>
              <dd className="truncate text-foreground">{deployment.author}</dd>
            </div>
          )}
          {whenLabel && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">When</dt>
              <dd className="text-foreground">{whenLabel}</dd>
            </div>
          )}
        </dl>
      )}

      {!target.worker_name && (
        <p className="text-xs text-muted-foreground">
          No Cloudflare Worker configured for this site.
        </p>
      )}

      {target.kind === "site" && target.worker_name && target.site_id && (
        <div className="space-y-1.5 border-t pt-3">
          <Label htmlFor={`cf-acct-${target.slug}`} className="text-xs">
            Cloudflare Account ID
          </Label>
          <div className="flex gap-2">
            <Input
              id={`cf-acct-${target.slug}`}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Paste Account ID from CF dashboard"
              className="h-8 font-mono text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                saving ||
                accountId.trim() === (target.cloudflare_account_id ?? "")
              }
              onClick={handleSaveAccountId}
            >
              {saving ? "…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {target.kind === "app" && (
        <p className="border-t pt-3 text-[11px] text-muted-foreground">
          Booking Broom Account ID comes from Convex env{" "}
          <code className="rounded bg-muted px-1">CLOUDFLARE_ACCOUNT_ID</code>.
        </p>
      )}

      {deployment?.dashboard_url && (
        <a
          href={deployment.dashboard_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Open in Cloudflare
          <ArrowSquareOut size={14} />
        </a>
      )}
    </article>
  );
}
