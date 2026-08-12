import { ScrollView, StyleSheet, View } from "react-native";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
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
import { spacing } from "@/theme/tokens";

export default function SpeedOpsScreen() {
  const { isAuthenticated } = useConvexAuth();
  const metrics = useQuery(
    api.pagespeed.listMetrics,
    isAuthenticated ? { strategy: "mobile" } : "skip"
  );
  const syncNow = useAction(api.pagespeedActions.syncNow);
  const [busy, setBusy] = useState(false);

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
        <Button
          label={busy ? "Auditing…" : "Sync PageSpeed (mobile)"}
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
        {metrics.length === 0 ? (
          <EmptyState title="No performance data" />
        ) : (
          metrics.map(
            (row: {
              site: { slug: string; name: string; domain: string };
              metrics: {
                performance_score: number | null;
                lcp_ms: number | null;
                cls: number | null;
              } | null;
            }) => (
              <Card key={row.site.slug}>
                <View style={styles.row}>
                  <AppText weight="semibold" style={{ flex: 1 }}>
                    {row.site.name}
                  </AppText>
                  <Badge
                    label={
                      row.metrics?.performance_score != null
                        ? String(Math.round(row.metrics.performance_score))
                        : "—"
                    }
                    tone="primary"
                  />
                </View>
                <AppText muted size={12} style={{ marginTop: 4 }}>
                  {row.site.domain}
                </AppText>
                {row.metrics ? (
                  <AppText muted size={13} style={{ marginTop: 8 }}>
                    LCP{" "}
                    {row.metrics.lcp_ms != null
                      ? `${Math.round(row.metrics.lcp_ms)}ms`
                      : "—"}{" "}
                    · CLS{" "}
                    {row.metrics.cls != null
                      ? row.metrics.cls.toFixed(3)
                      : "—"}
                  </AppText>
                ) : (
                  <AppText muted size={13} style={{ marginTop: 8 }}>
                    Run sync to audit this site.
                  </AppText>
                )}
              </Card>
            )
          )
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
