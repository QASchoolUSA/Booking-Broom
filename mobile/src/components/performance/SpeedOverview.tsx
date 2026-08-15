import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

export type SpeedMetricRow = {
  metrics: {
    performance_score: number | null;
    agentic_browsing_score: number | null;
    error: string | null;
  } | null;
};

function avgScore(
  rows: SpeedMetricRow[],
  key: "performance_score" | "agentic_browsing_score"
): number | null {
  const values = rows
    .map((r) => r.metrics?.[key])
    .filter((n): n is number => typeof n === "number");
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function scoreTint(
  score: number | null,
  colors: { success: string; accent: string; destructive: string; muted: string }
) {
  if (score == null) return colors.muted;
  if (score >= 90) return colors.success;
  if (score >= 50) return colors.accent;
  return colors.destructive;
}

export function SpeedOverview({ rows }: { rows: SpeedMetricRow[] }) {
  const { colors } = useTheme();

  const stats = useMemo(() => {
    const withMetrics = rows.filter((r) => r.metrics && !r.metrics.error);
    const failed = rows.filter((r) => r.metrics?.error).length;
    const good = withMetrics.filter(
      (r) => (r.metrics?.performance_score ?? 0) >= 90
    ).length;
    const avgPerf = avgScore(withMetrics, "performance_score");
    const avgAgent = avgScore(withMetrics, "agentic_browsing_score");
    return [
      { label: "Avg perf", value: avgPerf != null ? String(avgPerf) : "—", score: avgPerf },
      { label: "Avg agent", value: avgAgent != null ? String(avgAgent) : "—", score: avgAgent },
      { label: "Good 90+", value: String(good), score: good > 0 ? 90 : null },
      { label: "Failed", value: String(failed), score: failed > 0 ? 40 : null },
    ];
  }, [rows]);

  return (
    <View style={styles.grid}>
      {stats.map((s) => (
        <View
          key={s.label}
          style={[
            styles.chip,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: scoreTint(s.score, colors) },
            ]}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText weight="bold" size={22} style={{ fontVariant: ["tabular-nums"] }}>
              {s.value}
            </AppText>
            <AppText muted size={11} weight="medium">
              {s.label}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    width: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
