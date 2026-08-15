import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useNavigation } from "expo-router";
import { RefreshCw } from "lucide-react-native";
import {
  AppText,
  Badge,
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

type SeoPeriodDays = 1 | 7 | 28 | 90;
type SeoSource = "google" | "bing";

const PERIODS: { value: SeoPeriodDays; label: string; short: string }[] = [
  { value: 1, label: "24 hours", short: "24h" },
  { value: 7, label: "7 days", short: "7d" },
  { value: 28, label: "28 days", short: "28d" },
  { value: 90, label: "3 months", short: "3mo" },
];

export default function SeoOpsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { isAuthenticated } = useConvexAuth();
  const [period, setPeriod] = useState<SeoPeriodDays>(28);
  const [source, setSource] = useState<SeoSource>("google");
  const [busy, setBusy] = useState(false);

  const gscMetrics = useQuery(
    api.gsc.listMetrics,
    isAuthenticated && source === "google" ? { periodDays: period } : "skip"
  );
  const bingMetrics = useQuery(
    api.bing.listMetrics,
    isAuthenticated && source === "bing" ? { periodDays: period } : "skip"
  );
  const syncGoogle = useAction(api.gscActions.syncNow);
  const syncBing = useAction(api.bingActions.syncNow);

  const metrics = source === "google" ? gscMetrics : bingMetrics;
  const rows = useMemo(
    () => (metrics ?? []) as SeoMetricRow[],
    [metrics]
  );
  const periodMeta = PERIODS.find((p) => p.value === period) ?? PERIODS[2]!;

  const onRefresh = useCallback(async () => {
    setBusy(true);
    try {
      if (source === "google") await syncGoogle({});
      else await syncBing({});
    } finally {
      setBusy(false);
    }
  }, [source, syncBing, syncGoogle]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => void onRefresh()}
          disabled={busy}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Refresh SEO metrics"
          style={{ paddingHorizontal: 8, opacity: busy ? 0.5 : 1 }}
        >
          <RefreshCw size={20} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [busy, colors.primary, navigation, onRefresh]);

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
        <View style={styles.sourceRow}>
          {(["google", "bing"] as const).map((value) => {
            const on = source === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSource(value)}
                style={[
                  styles.sourceChip,
                  {
                    backgroundColor: on ? colors.primary : colors.muted,
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
                  {value}
                </AppText>
              </Pressable>
            );
          })}
        </View>

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
          <SeoOverview
            rows={rows}
            periodLabel={periodMeta.short}
            showPosition={source === "google"}
          />
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
                    {(row.metrics.ctr * 100).toFixed(1)}%
                    {source === "google"
                      ? ` · Pos ${row.metrics.position.toFixed(1)}`
                      : ""}
                  </AppText>
                ) : (
                  <AppText muted size={13} style={{ marginTop: 8 }}>
                    {source === "google"
                      ? "Sync to pull Search Console data."
                      : "Sync to pull Bing Webmaster data."}
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
                      <View
                        key={`${row.site.slug}-${q.query}-${i}`}
                        style={styles.kwRow}
                      >
                        <AppText muted size={12} style={{ width: 18 }}>
                          {i + 1}.
                        </AppText>
                        <AppText
                          size={13}
                          numberOfLines={1}
                          style={{ flex: 1 }}
                        >
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
  sourceRow: { flexDirection: "row", gap: spacing.sm },
  sourceChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.md,
  },
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
