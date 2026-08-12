import { ScrollView, StyleSheet, View } from "react-native";
import { useConvexAuth, useQuery } from "convex/react";
import {
  AppText,
  Card,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";
import { spacing } from "@/theme/tokens";

export default function PricingOpsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const rows = useQuery(api.pricing.list, isAuthenticated ? {} : "skip");

  if (rows === undefined) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText muted size={13}>
          Reference basket totals from each site’s live pricing config. Edit
          detailed engines on the web Pricing workspace.
        </AppText>
        {rows.length === 0 ? (
          <EmptyState title="No pricing configs" />
        ) : (
          rows.map(
            (row: {
              site: { slug: string; name: string };
              pricing: { engine: string } | null;
              basket: {
                entries: Record<
                  string,
                  { low?: number; high?: number; price?: number } | undefined
                >;
              } | null;
            }) => {
              const entries = row.basket?.entries
                ? Object.entries(row.basket.entries).filter(([, v]) => v)
                : [];
              return (
                <Card key={row.site.slug}>
                  <AppText weight="semibold">{row.site.name}</AppText>
                  <AppText muted size={12} style={{ marginTop: 4 }}>
                    {row.pricing
                      ? `Engine: ${row.pricing.engine}`
                      : "Using seed defaults"}
                  </AppText>
                  {entries.length > 0 ? (
                    <View style={styles.basket}>
                      {entries.map(([key, value]) => {
                        const label =
                          value?.price != null
                            ? `$${value.price}`
                            : value?.low != null && value?.high != null
                              ? `$${value.low}–$${value.high}`
                              : value?.low != null
                                ? `$${value.low}`
                                : "—";
                        return (
                          <View
                            key={key}
                            style={[
                              styles.pill,
                              { backgroundColor: colors.muted },
                            ]}
                          >
                            <AppText size={12} weight="medium">
                              {key}: {label}
                            </AppText>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <AppText muted size={13} style={{ marginTop: 8 }}>
                      No basket available.
                    </AppText>
                  )}
                </Card>
              );
            }
          )
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  basket: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
