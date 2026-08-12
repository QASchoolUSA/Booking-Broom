import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import {
  SeoOverview,
  type SeoMetricRow,
} from "@/components/seo/SeoOverview";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://bookings.kedrik.com";

type SeoPeriodDays = 1 | 2 | 7 | 28 | 90;

const PERIODS: { value: SeoPeriodDays; label: string; short: string }[] = [
  { value: 1, label: "Today", short: "Today" },
  { value: 2, label: "Yesterday", short: "Yday" },
  { value: 7, label: "7 days", short: "7d" },
  { value: 28, label: "28 days", short: "28d" },
  { value: 90, label: "90 days", short: "90d" },
];

export default function SeoOpsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const [period, setPeriod] = useState<SeoPeriodDays>(28);
  const [busy, setBusy] = useState(false);

  const connection = useQuery(
    api.gsc.getConnection,
    isAuthenticated ? {} : "skip"
  );
  const metrics = useQuery(
    api.gsc.listMetrics,
    isAuthenticated ? { periodDays: period } : "skip"
  );
  const syncNow = useAction(api.gscActions.syncNow);

  const rows = useMemo(
    () => (metrics ?? []) as SeoMetricRow[],
    [metrics]
  );
  const periodMeta = PERIODS.find((p) => p.value === period) ?? PERIODS[3]!;

  if (metrics === undefined) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText weight="semibold">Google Search Console</AppText>
          <AppText muted size={13} style={{ marginTop: 4 }}>
            {connection
              ? `Connected · ${connection.google_email}`
              : "Not connected — OAuth must finish in the web app."}
          </AppText>
          <View style={styles.actions}>
            <Button
              label="Open web to connect"
              variant="secondary"
              onPress={() => Linking.openURL(`${WEB_URL}/seo`)}
            />
            <Button
              label={busy ? "Syncing…" : "Sync Google"}
              disabled={!connection || busy}
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
        </Card>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
          style={styles.periodScroll}
        >
          {PERIODS.map((p) => {
            const active = period === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                style={[
                  styles.periodChip,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                  },
                ]}
              >
                <AppText
                  size={12}
                  weight="semibold"
                  style={{
                    color: active
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  }}
                >
                  {p.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {rows.length > 0 ? (
          <SeoOverview rows={rows} periodLabel={periodMeta.short} />
        ) : null}

        {rows.length === 0 ? (
          <EmptyState title="No SEO metrics yet" />
        ) : (
          <>
            <AppText weight="semibold" style={{ marginTop: spacing.xs }}>
              By site
            </AppText>
            {rows.map((row) => (
              <Card key={row.site.slug}>
                <View style={styles.row}>
                  <AppText weight="semibold" style={{ flex: 1 }}>
                    {row.site.name}
                  </AppText>
                  <Badge
                    label={row.metrics ? periodMeta.short : "No data"}
                    tone={row.metrics ? "primary" : "neutral"}
                  />
                </View>
                {row.metrics ? (
                  <AppText muted size={13} style={{ marginTop: 8 }}>
                    Clicks {Math.round(row.metrics.clicks)} · Impr{" "}
                    {Math.round(row.metrics.impressions)} · CTR{" "}
                    {(row.metrics.ctr * 100).toFixed(1)}% · Pos{" "}
                    {row.metrics.position.toFixed(1)}
                  </AppText>
                ) : (
                  <AppText muted size={13} style={{ marginTop: 8 }}>
                    Sync to pull Search Console data.
                  </AppText>
                )}
                {(row.top_queries?.length ?? 0) > 0 ? (
                  <View style={styles.siteKeywords}>
                    <AppText
                      muted
                      size={11}
                      weight="semibold"
                      style={styles.siteKeywordsHeading}
                    >
                      Top keywords
                    </AppText>
                    {(row.top_queries ?? []).slice(0, 5).map((q, i) => (
                      <View key={`${row.site.slug}-${q.query}-${i}`} style={styles.kwRow}>
                        <AppText muted size={12} style={{ width: 18 }}>
                          {i + 1}.
                        </AppText>
                        <AppText size={13} numberOfLines={1} style={{ flex: 1 }}>
                          {q.query}
                        </AppText>
                        <AppText muted size={11}>
                          {Math.round(q.clicks)} clk
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  periodScroll: { flexGrow: 0, minHeight: 40 },
  periodRow: {
    gap: spacing.sm,
    alignItems: "center",
    paddingVertical: spacing.xs,
    minHeight: 40,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  siteKeywords: {
    marginTop: spacing.md,
    gap: 4,
  },
  siteKeywordsHeading: {
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kwRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    paddingVertical: 2,
  },
});
