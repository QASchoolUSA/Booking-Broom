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

export default function SitesOpsScreen() {
  const { isAuthenticated } = useConvexAuth();
  const rows = useQuery(
    api.siteHealth.listStatus,
    isAuthenticated ? {} : "skip"
  );
  const checkNow = useAction(api.siteHealthActions.checkNow);
  const [busy, setBusy] = useState(false);

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
        <Button
          label={busy ? "Checking…" : "Check health now"}
          onPress={async () => {
            setBusy(true);
            try {
              await checkNow({});
            } finally {
              setBusy(false);
            }
          }}
          loading={busy}
        />
        {rows.length === 0 ? (
          <EmptyState title="No sites" />
        ) : (
          rows.map(
            (row: {
              site: {
                slug: string;
                name: string;
                domain: string;
                hosting_provider: string | null;
                email_configured: boolean;
                phone_number: string | null;
              };
              health: {
                status: "online" | "offline";
                http_status: number | null;
                ip_address: string | null;
              } | null;
            }) => (
              <Card key={row.site.slug}>
                <View style={styles.row}>
                  <AppText weight="semibold" style={{ flex: 1 }}>
                    {row.site.name}
                  </AppText>
                  {row.health ? (
                    <Badge
                      label={row.health.status}
                      tone={
                        row.health.status === "online"
                          ? "success"
                          : "destructive"
                      }
                    />
                  ) : (
                    <Badge label="Unknown" />
                  )}
                </View>
                <AppText muted size={13} style={{ marginTop: 4 }}>
                  {row.site.domain}
                  {row.health?.ip_address
                    ? ` · ${row.health.ip_address}`
                    : ""}
                </AppText>
                <AppText muted size={12} style={{ marginTop: 8 }}>
                  Hosting: {row.site.hosting_provider ?? "—"} · Email:{" "}
                  {row.site.email_configured ? "ready" : "pending"}
                  {row.site.phone_number ? ` · ${row.site.phone_number}` : ""}
                  {row.health?.http_status != null
                    ? ` · HTTP ${row.health.http_status}`
                    : ""}
                </AppText>
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
