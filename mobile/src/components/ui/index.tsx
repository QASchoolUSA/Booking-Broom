import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

export function Screen({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppText({
  children,
  style,
  muted,
  weight = "regular",
  size = 15,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  weight?: "regular" | "medium" | "semibold" | "bold";
  size?: number;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const fontFamily =
    weight === "bold"
      ? "Poppins_700Bold"
      : weight === "semibold"
        ? "Poppins_600SemiBold"
        : weight === "medium"
          ? "OpenSans_600SemiBold"
          : "OpenSans_400Regular";
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: muted ? colors.mutedForeground : colors.foreground,
          fontSize: size,
          fontFamily,
          lineHeight: size * 1.35,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "accent";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  ...rest
}: {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
} & PressableProps) {
  const { colors } = useTheme();
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "accent"
        ? colors.accent
        : variant === "destructive"
          ? colors.destructive
          : variant === "secondary"
            ? colors.muted
            : "transparent";
  const fg =
    variant === "primary"
      ? colors.primaryForeground
      : variant === "accent"
        ? colors.accentForeground
        : variant === "destructive"
          ? colors.destructiveForeground
          : variant === "secondary"
            ? colors.foreground
            : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === "ghost" ? colors.border : "transparent",
          borderWidth: variant === "ghost" ? 1 : 0,
          opacity: disabled || loading ? 0.5 : pressed ? 0.88 : 1,
        },
        style as StyleProp<ViewStyle>,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            { color: fg, fontFamily: "Poppins_600SemiBold" },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = "none",
  keyboardType = "default",
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  placeholder?: string;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <AppText size={13} muted weight="medium">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        placeholder={placeholder}
        multiline={multiline}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            minHeight: multiline ? 96 : 48,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary" | "success" | "accent" | "destructive";
}) {
  const { colors } = useTheme();
  const bg =
    tone === "primary"
      ? colors.primary
      : tone === "success"
        ? colors.success
        : tone === "accent"
          ? colors.accent
          : tone === "destructive"
            ? colors.destructive
            : colors.muted;
  const fg =
    tone === "neutral"
      ? colors.foreground
      : tone === "success"
        ? colors.successForeground
        : tone === "destructive"
          ? colors.destructiveForeground
          : colors.primaryForeground;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text
        style={{
          color: fg,
          fontSize: 11,
          fontFamily: "OpenSans_600SemiBold",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <AppText weight="semibold" size={17}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText muted style={{ marginTop: spacing.sm, textAlign: "center" }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function LoadingBlock() {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: { fontSize: 15, letterSpacing: 0.2 },
  field: { gap: spacing.sm, marginBottom: spacing.lg },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
});
