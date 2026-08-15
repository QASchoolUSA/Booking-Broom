import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, RefreshCw } from "lucide-react-native";
import { AppText, Card } from "@/components/ui";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import type { Id } from "@/lib/api";

export type SiteSpeedMetrics = {
  url: string;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  agentic_browsing_score: number | null;
  agentic_browsing_passed: number | null;
  agentic_browsing_total: number | null;
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  fcp_ms: number | null;
  error: string | null;
  synced_at: string;
};

export type SiteSpeedRow = {
  site: {
    id: Id<"sites">;
    slug: string;
    name: string;
    domain: string;
    accent_color: string;
    performance_url: string | null;
  };
  metrics: SiteSpeedMetrics | null;
};

function scoreColor(
  score: number | null,
  colors: { success: string; accent: string; destructive: string; mutedForeground: string }
) {
  if (score == null) return colors.mutedForeground;
  if (score >= 90) return colors.success;
  if (score >= 50) return colors.accent;
  return colors.destructive;
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatCls(cls: number | null): string {
  if (cls == null) return "—";
  return cls.toFixed(3);
}

function ScorePill({
  label,
  score,
  display,
}: {
  label: string;
  score: number | null;
  display?: string;
}) {
  const { colors } = useTheme();
  const tint = scoreColor(score, colors);
  return (
    <View style={styles.pill}>
      <AppText
        weight="bold"
        size={15}
        style={{ color: tint, fontVariant: ["tabular-nums"] }}
      >
        {display ?? (score != null ? String(Math.round(score)) : "—")}
      </AppText>
      <AppText muted size={10} weight="medium">
        {label}
      </AppText>
    </View>
  );
}

export function SiteSpeedCard({
  row,
  onRefresh,
}: {
  row: SiteSpeedRow;
  onRefresh: (siteId: Id<"sites">) => Promise<void>;
}) {
  const { colors } = useTheme();
  const { site, metrics } = row;
  const [refreshing, setRefreshing] = useState(false);

  const psiUrl = metrics?.url
    ? `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(metrics.url)}`
    : `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`https://${site.domain}`)}`;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh(site.id);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View
          style={[styles.accent, { backgroundColor: site.accent_color }]}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText weight="semibold" size={16} numberOfLines={1}>
            {site.name}
          </AppText>
          <AppText muted size={12} numberOfLines={1}>
            {metrics?.url ?? site.domain}
          </AppText>
        </View>
        <Pressable
          onPress={handleRefresh}
          hitSlop={8}
          disabled={refreshing}
          style={styles.iconBtn}
        >
          <RefreshCw
            size={16}
            color={colors.mutedForeground}
            style={refreshing ? { opacity: 0.5 } : undefined}
          />
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(psiUrl)}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <ExternalLink size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {metrics?.error && metrics.performance_score == null ? (
        <AppText muted size={13} style={{ marginTop: spacing.sm }}>
          {metrics.error}
        </AppText>
      ) : metrics ? (
        <>
          <View style={styles.scores}>
            <ScorePill label="Perf" score={metrics.performance_score} />
            <ScorePill label="A11y" score={metrics.accessibility_score} />
            <ScorePill label="BP" score={metrics.best_practices_score} />
            <ScorePill label="SEO" score={metrics.seo_score} />
            <ScorePill
              label="Agent"
              score={metrics.agentic_browsing_score}
              display={
                metrics.agentic_browsing_passed != null &&
                metrics.agentic_browsing_total != null
                  ? `${metrics.agentic_browsing_passed}/${metrics.agentic_browsing_total}`
                  : undefined
              }
            />
          </View>
          <View style={styles.cwv}>
            {[
              { label: "LCP", value: formatMs(metrics.lcp_ms) },
              { label: "CLS", value: formatCls(metrics.cls) },
              { label: "INP", value: formatMs(metrics.inp_ms) },
              { label: "FCP", value: formatMs(metrics.fcp_ms) },
            ].map((c) => (
              <View
                key={c.label}
                style={[
                  styles.cwvTile,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <AppText muted size={10} weight="semibold">
                  {c.label}
                </AppText>
                <AppText weight="semibold" size={13}>
                  {c.value}
                </AppText>
              </View>
            ))}
          </View>
          <AppText muted size={11} style={{ marginTop: spacing.sm }}>
            Synced{" "}
            {formatDistanceToNow(new Date(metrics.synced_at), {
              addSuffix: true,
            })}
          </AppText>
        </>
      ) : (
        <AppText muted size={13} style={{ marginTop: spacing.sm }}>
          Run sync to audit this site.
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  accent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  iconBtn: {
    padding: 4,
  },
  scores: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  pill: {
    alignItems: "center",
    gap: 2,
    minWidth: 44,
  },
  cwv: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cwvTile: {
    width: "47%",
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
});
