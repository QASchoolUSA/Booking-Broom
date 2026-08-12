import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthActions } from "@convex-dev/auth/react";
import { Sparkles } from "lucide-react-native";
import { useTheme } from "@/theme";
import { spacing, radius } from "@/theme/tokens";
import { AppText, Button, Screen, TextField } from "@/components/ui";

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn("password", {
        email: email.trim(),
        password,
        flow: isSignUp ? "signUp" : "signIn",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: "rgba(255,255,255,0.18)" },
              ]}
            >
              <Sparkles size={28} color="#fff" />
            </View>
            <AppText
              weight="bold"
              size={28}
              style={{ color: "#fff", marginTop: spacing.lg }}
            >
              Booking Broom
            </AppText>
            <AppText
              size={15}
              style={{ color: "rgba(255,255,255,0.85)", marginTop: spacing.sm }}
            >
              Manager control for every cleaning site — live bookings, messages,
              and ops.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText weight="semibold" size={22}>
              {isSignUp ? "Create manager account" : "Sign in"}
            </AppText>
            <AppText muted style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}>
              {isSignUp
                ? "First time only — use a strong password."
                : "Use your Booking Broom manager credentials."}
            </AppText>

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="you@company.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />

            {error ? (
              <AppText
                style={{ color: colors.destructive, marginBottom: spacing.md }}
                size={13}
              >
                {error}
              </AppText>
            ) : null}

            <Button
              label={isSignUp ? "Create account" : "Sign in"}
              onPress={onSubmit}
              loading={loading}
            />

            <Button
              label={
                isSignUp
                  ? "Already have an account? Sign in"
                  : "First time? Create manager account"
              }
              variant="ghost"
              onPress={() => {
                setIsSignUp((v) => !v);
                setError(null);
              }}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
});
