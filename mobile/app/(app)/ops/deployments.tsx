import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

type DeploymentRow = {
  target: {
    kind: "app" | "site";
    slug: string;
    name: string;
    domain: string | null;
    worker_name: string | null;
    cloudflare_account_id: string | null;
  };
  deployment: {
    status: string | null;
    build_outcome: string | null;
    branch: string | null;
    commit_hash: string | null;
    commit_message: string | null;
    dashboard_url: string | null;
    requests_today: number | null;
    requests_limit: number;
    requests_remaining: number | null;
    build_minutes_limit_reached: boolean | null;
    error: string | null;
    checked_at: string;
  } | null;
};

function statusTone(
  row: DeploymentRow
): "success" | "destructive" | "accent" | "neutral" {
  if (!row.target.worker_name) return "neutral";
  const d = row.deployment;
  if (!d) return "neutral";
  if (d.error && !d.status) return "accent";
  const status = (d.status ?? "").toLowerCase();
  if (status === "queued" || status === "initializing" || status === "running") {
    return "accent";
  }
  const outcome = (d.build_outcome ?? "").toLowerCase();
  if (outcome === "success") return "success";
  if (outcome === "fail" || outcome === "cancelled" || outcome === "terminated") {
    return "destructive";
  }
  return "neutral";
}

function statusLabel(row: DeploymentRow): string {
  if (!row.target.worker_name) return "Not on Cloudflare";
  const d = row.deployment;
  if (!d) return "Not synced";
  if (d.error && !d.build_outcome) return "Error";
  const status = (d.status ?? "").toLowerCase();
  if (status === "running") return "Building";
  if (status === "queued" || status === "initializing") return status;
  const outcome = (d.build_outcome ?? "").toLowerCase();
  if (outcome === "success") return "Success";
  if (outcome === "fail") return "Failed";
  if (outcome) return outcome;
  return d.status ?? "Unknown";
}

export default function DeploymentsOpsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const [busy, setBusy] = useState(false);

  const rowsRaw = useQuery(
    api.deployments.listStatus,
    isAuthenticated ? {} : "skip"
  );
  const syncState = useQuery(
    api.deployments.getSyncState,
    isAuthenticated ? {} : "skip"
  );
  const syncNow = useAction(api.deploymentsActions.syncNow);

  if (!isAuthenticated) {
    return (
      <Screen>
        <EmptyState title="Sign in to view deployments" />
      </Screen>
    );
  }

  if (rowsRaw === undefined || syncState === undefined) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  const rows = rowsRaw as DeploymentRow[];
  const lastSync = syncState?.last_sync_at
    ? formatDistanceToNow(new Date(syncState.last_sync_at), { addSuffix: true })
    : null;

  let success = 0;
  let failed = 0;
  let building = 0;
  let usageWarn = 0;
  for (const row of rows) {
    const tone = statusTone(row);
    if (tone === "success") success += 1;
    else if (tone === "destructive") failed += 1;
    else if (
      row.deployment &&
      ["queued", "initializing", "running"].includes(
        (row.deployment.status ?? "").toLowerCase()
      )
    ) {
      building += 1;
    }
    const used = row.deployment?.requests_today;
    const limit = row.deployment?.requests_limit ?? 100_000;
    if (
      row.deployment?.build_minutes_limit_reached === true ||
      (used != null && limit > 0 && used / limit >= 0.7)
    ) {
      usageWarn += 1;
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.syncStrip,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="semibold" size={14}>
              Cloudflare Workers Builds
            </AppText>
            <AppText muted size={12}>
              {lastSync
                ? `Last synced ${lastSync}`
                : "No sync yet — pull latest builds & usage"}
            </AppText>
            {syncState?.last_sync_error ? (
              <AppText size={12} style={{ color: colors.destructive }}>
                {syncState.last_sync_error}
              </AppText>
            ) : null}
          </View>
          <Button
            label={busy ? "Syncing…" : "Sync now"}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const result = await syncNow({});
                if (result.error) {
                  Alert.alert("Synced with errors", result.error);
                }
              } catch (e) {
                Alert.alert(
                  "Sync failed",
                  e instanceof Error ? e.message : "Deployment sync failed"
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>

        <View style={styles.overview}>
          {[
            { label: "Success", value: String(success) },
            { label: "Failed", value: String(failed) },
            { label: "Building", value: String(building) },
            { label: "Usage alerts", value: String(usageWarn) },
          ].map((s) => (
            <View
              key={s.label}
              style={[
                styles.stat,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppText weight="bold" size={20}>
                {s.value}
              </AppText>
              <AppText muted size={11}>
                {s.label}
              </AppText>
            </View>
          ))}
        </View>

        {rows.length === 0 ? (
          <EmptyState title="No deployment targets" />
        ) : (
          rows.map((row) => {
            const d = row.deployment;
            const used = d?.requests_today;
            const remaining = d?.requests_remaining;
            const limit = d?.requests_limit ?? 100_000;
            const pct =
              used != null && limit > 0
                ? Math.min(100, Math.round((used / limit) * 100))
                : null;
            const sha = d?.commit_hash?.slice(0, 7);

            return (
              <Card key={`${row.target.kind}:${row.target.slug}`}>
                <View style={styles.rowTop}>
                  <AppText weight="semibold" style={{ flex: 1 }}>
                    {row.target.name}
                  </AppText>
                  <Badge label={statusLabel(row)} tone={statusTone(row)} />
                </View>
                <AppText muted size={12} style={{ marginTop: 4 }}>
                  {row.target.worker_name ?? "—"}
                  {row.target.domain ? ` · ${row.target.domain}` : ""}
                </AppText>

                {d?.error ? (
                  <AppText
                    size={12}
                    style={{ color: colors.destructive, marginTop: spacing.sm }}
                  >
                    {d.error}
                  </AppText>
                ) : null}

                {used != null && remaining != null ? (
                  <View style={{ marginTop: spacing.sm, gap: 4 }}>
                    <View style={styles.rowTop}>
                      <AppText muted size={12}>
                        Free requests today
                      </AppText>
                      <AppText size={12} weight="semibold">
                        {remaining.toLocaleString()} left · {pct}%
                      </AppText>
                    </View>
                    <View
                      style={[
                        styles.meterTrack,
                        { backgroundColor: colors.muted },
                      ]}
                    >
                      <View
                        style={[
                          styles.meterFill,
                          {
                            width: `${pct ?? 0}%`,
                            backgroundColor:
                              (pct ?? 0) >= 90
                                ? colors.destructive
                                : (pct ?? 0) >= 70
                                  ? "#F59E0B"
                                  : colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}

                {d?.build_minutes_limit_reached != null ? (
                  <AppText
                    size={12}
                    style={{
                      marginTop: spacing.sm,
                      color: d.build_minutes_limit_reached
                        ? colors.destructive
                        : colors.mutedForeground,
                    }}
                  >
                    Builds minutes:{" "}
                    {d.build_minutes_limit_reached
                      ? "Free limit reached"
                      : "OK"}
                  </AppText>
                ) : null}

                {(d?.branch || sha) && (
                  <AppText muted size={12} style={{ marginTop: spacing.sm }}>
                    {d?.branch ?? "—"}
                    {sha ? ` @ ${sha}` : ""}
                  </AppText>
                )}

                {d?.dashboard_url ? (
                  <Pressable
                    onPress={() => Linking.openURL(d.dashboard_url!)}
                    style={{ marginTop: spacing.sm }}
                  >
                    <AppText size={13} weight="semibold" style={{ color: colors.primary }}>
                      Open in Cloudflare
                    </AppText>
                  </Pressable>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  syncStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  overview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stat: {
    width: "48%",
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meterTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 999,
  },
});
