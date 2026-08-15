import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AppText,
  Button,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { SpeedOverview } from "@/components/performance/SpeedOverview";
import {
  SiteSpeedCard,
  type SiteSpeedRow,
} from "@/components/performance/SiteSpeedCard";
import { api, type Id } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

type Strategy = "mobile" | "desktop";

export default function SpeedOpsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const [strategy, setStrategy] = useState<Strategy>("mobile");
  const [busy, setBusy] = useState(false);

  const metrics = useQuery(
    api.pagespeed.listMetrics,
    isAuthenticated ? { strategy } : "skip"
  );
  const syncState = useQuery(
    api.pagespeed.getSyncState,
    isAuthenticated ? {} : "skip"
  );
  const syncNow = useAction(api.pagespeedActions.syncNow);
  const syncSite = useAction(api.pagespeedActions.syncSite);

  if (metrics === undefined || syncState === undefined) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  const rows = metrics as SiteSpeedRow[];
  const lastSync = syncState?.last_sync_at
    ? formatDistanceToNow(new Date(syncState.last_sync_at), { addSuffix: true })
    : null;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.strategyRow}>
          {(["mobile", "desktop"] as const).map((s) => {
            const on = strategy === s;
            return (
              <Pressable
                key={s}
                onPress={() => setStrategy(s)}
                style={[
                  styles.strategyChip,
                  {
                    backgroundColor: on ? colors.primary : colors.muted,
                    borderColor: on ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText
                  size={13}
                  weight="semibold"
                  style={{
                    color: on ? colors.primaryForeground : colors.foreground,
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.syncStrip,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="semibold" size={14}>
              PageSpeed sync
            </AppText>
            <AppText muted size={12}>
              {lastSync
                ? `Last synced ${lastSync}`
                : "No sync yet — run an audit"}
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
                await syncNow({});
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>

        <SpeedOverview rows={rows} />

        {rows.length === 0 ? (
          <EmptyState title="No performance data" />
        ) : (
          rows.map((row) => (
            <SiteSpeedCard
              key={row.site.slug}
              row={row}
              onRefresh={async (siteId: Id<"sites">) => {
                await syncSite({ siteId, strategy });
              }}
            />
          ))
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
  strategyRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  strategyChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  syncStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
