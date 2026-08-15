import React, { useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Trash2 } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme";
import { spacing } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  onDelete: () => void;
  enabled?: boolean;
};

export function SwipeToDeleteRow({
  children,
  onDelete,
  enabled = true,
}: Props) {
  const { colors } = useTheme();
  const ref = useRef<Swipeable>(null);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={ref}
      friction={2}
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              ref.current?.close();
              onDelete();
            }}
            style={[styles.deleteBtn, { backgroundColor: colors.destructive }]}
            accessibilityRole="button"
            accessibilityLabel="Delete"
          >
            <Trash2 size={20} color={colors.destructiveForeground} />
            <AppText
              size={12}
              weight="semibold"
              style={{ color: colors.destructiveForeground, marginTop: 4 }}
            >
              Delete
            </AppText>
          </Pressable>
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 0,
  },
  deleteBtn: {
    width: 88,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
});
