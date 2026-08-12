import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Globe,
  ChartLine,
  Gauge,
  DollarSign,
  ChevronRight,
} from "lucide-react-native";
import { AppText, Card, Screen } from "@/components/ui";
import { useTheme } from "@/theme";
import { spacing } from "@/theme/tokens";

const LINKS = [
  {
    href: "/ops/sites",
    title: "Sites",
    subtitle: "Hosting, health, and ops checklist",
    icon: Globe,
  },
  {
    href: "/ops/seo",
    title: "SEO",
    subtitle: "Google & Bing metrics, page scans",
    icon: ChartLine,
  },
  {
    href: "/ops/speed",
    title: "Speed",
    subtitle: "PageSpeed Insights by site",
    icon: Gauge,
  },
  {
    href: "/ops/pricing",
    title: "Pricing",
    subtitle: "Compare and edit site pricing configs",
    icon: DollarSign,
  },
] as const;

export default function OpsHubScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 120,
        }}
      >
        <AppText muted style={{ marginBottom: spacing.sm }}>
          Operations tools for every cleaning website.
        </AppText>
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.href}
              onPress={() => router.push(item.href as never)}
            >
              <View style={styles.row}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  <Icon size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">{item.title}</AppText>
                  <AppText muted size={13} style={{ marginTop: 2 }}>
                    {item.subtitle}
                  </AppText>
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
