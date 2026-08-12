import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import type { Id } from "@/lib/api";

export type MailboxChip = {
  id: Id<"emailMailboxes">;
  site_name: string | null;
  email: string;
  site_accent: string | null;
  unread_count: number;
};

type Props = {
  mailboxes: MailboxChip[];
  selectedMailboxId: string | null;
  onSelect: (mailboxId: string) => void;
};

export function MailboxChips({
  mailboxes,
  selectedMailboxId,
  onSelect,
}: Props) {
  const { colors } = useTheme();

  if (mailboxes.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroll}
      >
        {mailboxes.map((box) => {
          const active = selectedMailboxId === box.id;
          const unread = box.unread_count > 0;
          const label = box.site_name || box.email.split("@")[0] || box.email;
          return (
            <Pressable
              key={box.id}
              onPress={() => onSelect(box.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.muted,
                },
              ]}
            >
              {box.site_accent ? (
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: active
                        ? colors.primaryForeground
                        : box.site_accent,
                      opacity: active ? 0.85 : 1,
                    },
                  ]}
                />
              ) : null}
              <AppText
                size={12}
                weight="semibold"
                numberOfLines={1}
                style={{
                  maxWidth: 140,
                  lineHeight: 16,
                  color: active
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                }}
              >
                {label}
              </AppText>
              {unread ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: active
                        ? "rgba(255,255,255,0.22)"
                        : colors.primary,
                    },
                  ]}
                >
                  <AppText
                    size={10}
                    weight="bold"
                    style={{
                      lineHeight: 12,
                      color: colors.primaryForeground,
                    }}
                  >
                    {box.unread_count > 99 ? "99+" : String(box.unread_count)}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.md,
  },
  scroll: {
    flexGrow: 0,
    // Horizontal ScrollViews clip vertical overflow; give chips full height room.
    minHeight: 40,
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    alignItems: "center",
    minHeight: 40,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    minHeight: 36,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
