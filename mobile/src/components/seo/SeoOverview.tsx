import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  Eye,
  Hash,
  MousePointerClick,
  Percent,
} from "lucide-react-native";
import { AppText, Card } from "@/components/ui";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

type Metric = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type Delta = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoMetricRow = {
  site: { slug: string; name: string };
  metrics: Metric | null;
  delta?: Delta | null;
  top_queries?: {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[] | null;
};

type MetricDirection = "higher-better" | "lower-better";

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}

function formatPosition(pos: number): string {
  if (pos <= 0) return "—";
  return pos.toFixed(1);
}

function formatSignedNumber(n: number, digits = 0): string {
  if (Math.abs(n) < 1 / Math.pow(10, digits + 1)) return "0";
  const rounded =
    digits === 0 ? Math.round(n) : Number(n.toFixed(digits));
  if (rounded === 0) return "0";
  const abs =
    digits === 0
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
          Math.abs(rounded)
        )
      : Math.abs(rounded).toFixed(digits);
  return `${rounded > 0 ? "+" : "−"}${abs}`;
}

function formatSignedCtr(delta: number): string {
  const pct = delta * 100;
  if (Math.abs(pct) < 0.05) return "0%";
  const abs = Math.abs(pct).toFixed(1);
  return `${pct > 0 ? "+" : "−"}${abs}%`;
}

function deltaColor(
  delta: number,
  direction: MetricDirection,
  colors: { success: string; destructive: string; mutedForeground: string }
) {
  if (Math.abs(delta) < 1e-9) return colors.mutedForeground;
  const improved = direction === "higher-better" ? delta > 0 : delta < 0;
  return improved ? colors.success : colors.destructive;
}

type Props = {
  rows: SeoMetricRow[];
  showPosition?: boolean;
  periodLabel?: string;
};

export function SeoOverview({
  rows,
  showPosition = true,
  periodLabel = "28d",
}: Props) {
  const { colors } = useTheme();

  const overview = useMemo(() => {
    const withMetrics = rows.filter((r) => r.metrics);
    const totalClicks = withMetrics.reduce(
      (s, r) => s + (r.metrics?.clicks ?? 0),
      0
    );
    const totalImpressions = withMetrics.reduce(
      (s, r) => s + (r.metrics?.impressions ?? 0),
      0
    );
    const avgCtr =
      totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    let weightedPos = 0;
    let weight = 0;
    for (const r of withMetrics) {
      const m = r.metrics!;
      if (m.impressions > 0 && m.position > 0) {
        weightedPos += m.position * m.impressions;
        weight += m.impressions;
      }
    }
    const avgPosition = weight > 0 ? weightedPos / weight : 0;

    const withDelta = withMetrics.filter((r) => r.delta);
    let clicksDelta: number | null = null;
    let impressionsDelta: number | null = null;
    let ctrDelta: number | null = null;
    let positionDelta: number | null = null;

    if (withDelta.length > 0) {
      clicksDelta = withDelta.reduce((s, r) => s + (r.delta?.clicks ?? 0), 0);
      impressionsDelta = withDelta.reduce(
        (s, r) => s + (r.delta?.impressions ?? 0),
        0
      );
      const prevClicks = totalClicks - clicksDelta;
      const prevImpressions = totalImpressions - impressionsDelta;
      const prevCtr =
        prevImpressions > 0 ? prevClicks / prevImpressions : 0;
      ctrDelta = avgCtr - prevCtr;

      let prevWeighted = 0;
      let prevWeight = 0;
      for (const r of withDelta) {
        const m = r.metrics!;
        const d = r.delta!;
        const prevImp = m.impressions - d.impressions;
        const prevPos = m.position - d.position;
        if (prevImp > 0 && prevPos > 0) {
          prevWeighted += prevPos * prevImp;
          prevWeight += prevImp;
        }
      }
      if (prevWeight > 0 && avgPosition > 0) {
        positionDelta = avgPosition - prevWeighted / prevWeight;
      }
    }

    return {
      sitesWithData: withMetrics.length,
      stats: [
        {
          label: "Clicks",
          value: formatNumber(totalClicks),
          deltaText:
            clicksDelta !== null ? formatSignedNumber(clicksDelta) : null,
          deltaValue: clicksDelta ?? 0,
          direction: "higher-better" as MetricDirection,
          Icon: MousePointerClick,
        },
        {
          label: "Impressions",
          value: formatNumber(totalImpressions),
          deltaText:
            impressionsDelta !== null
              ? formatSignedNumber(impressionsDelta)
              : null,
          deltaValue: impressionsDelta ?? 0,
          direction: "higher-better" as MetricDirection,
          Icon: Eye,
        },
        {
          label: "Avg CTR",
          value: withMetrics.length ? formatCtr(avgCtr) : "—",
          deltaText: ctrDelta !== null ? formatSignedCtr(ctrDelta) : null,
          deltaValue: ctrDelta ?? 0,
          direction: "higher-better" as MetricDirection,
          Icon: Percent,
        },
        ...(showPosition
          ? [
              {
                label: "Avg position",
                value: withMetrics.length
                  ? formatPosition(avgPosition)
                  : "—",
                deltaText:
                  positionDelta !== null
                    ? formatSignedNumber(positionDelta, 1)
                    : null,
                deltaValue: positionDelta ?? 0,
                direction: "lower-better" as MetricDirection,
                Icon: Hash,
              },
            ]
          : []),
      ],
    };
  }, [rows, showPosition]);

  if (rows.length === 0) return null;

  return (
    <View style={styles.block}>
      <View style={styles.heading}>
        <AppText weight="semibold">All sites</AppText>
        <AppText muted size={12}>
          {overview.sitesWithData} with data · {periodLabel}
        </AppText>
      </View>
      <View style={styles.grid}>
        {overview.stats.map(
          ({ label, value, deltaText, deltaValue, direction, Icon }) => (
            <Card key={label} style={styles.statCard}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Icon size={18} color={colors.primary} />
              </View>
              <AppText weight="bold" size={22} style={styles.value}>
                {value}
              </AppText>
              {deltaText ? (
                <AppText
                  size={12}
                  weight="medium"
                  style={{
                    color: deltaColor(deltaValue, direction, colors),
                    marginTop: 2,
                  }}
                >
                  {deltaText}
                </AppText>
              ) : null}
              <AppText muted size={12} style={{ marginTop: 4 }}>
                {label}
              </AppText>
            </Card>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    gap: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  value: {
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
});
