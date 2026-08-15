import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useRouter, type Href } from "expo-router";
import {
  AppText,
  Button,
  Screen,
  TextField,
} from "@/components/ui";
import { api } from "@/lib/api";
import { encodeSmsThreadId } from "@/lib/smsThreadId";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

type SmsDid = {
  did: string;
  description: string | null;
  sub_account: string | null;
  formatted: string;
};

function didLabel(did: SmsDid) {
  const desc = did.description?.trim();
  if (desc) return desc;
  const sub = did.sub_account?.replace(/^\d+_/, "").trim();
  if (sub) return sub;
  return did.formatted;
}

export default function ComposeMessageScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const dids = useQuery(api.sms.listDids, isAuthenticated ? {} : "skip") as
    | SmsDid[]
    | undefined;
  const sendMessage = useAction(api.voipmsActions.sendMessage);

  const [fromDid, setFromDid] = useState("");
  const [toRaw, setToRaw] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!fromDid && dids && dids.length > 0) {
      setFromDid(dids[0]!.did);
    }
  }, [dids, fromDid]);

  const onSend = async () => {
    const message = body.trim();
    if (!fromDid) {
      Alert.alert("Pick a From number");
      return;
    }
    if (!toRaw.trim()) {
      Alert.alert("Enter a recipient");
      return;
    }
    if (!message) {
      Alert.alert("Enter a message");
      return;
    }
    if (message.length > 160) {
      Alert.alert("SMS is limited to 160 characters");
      return;
    }
    setSending(true);
    try {
      await sendMessage({ did: fromDid, contact: toRaw, message });
      const digits = toRaw.replace(/\D/g, "");
      const contact =
        digits.length === 11 && digits.startsWith("1")
          ? digits.slice(1)
          : digits.slice(-10);
      router.replace(
        `/messages/${encodeSmsThreadId(fromDid, contact)}` as Href
      );
    } catch (e) {
      Alert.alert(
        "Send failed",
        e instanceof Error ? e.message : "Could not send the message"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText muted size={13} style={{ marginBottom: spacing.sm }}>
          From
        </AppText>
        <View style={styles.didRow}>
          {(dids ?? []).map((did) => {
            const on = fromDid === did.did;
            return (
              <Pressable
                key={did.did}
                onPress={() => setFromDid(did.did)}
                style={[
                  styles.didChip,
                  {
                    backgroundColor: on ? colors.primary : colors.muted,
                  },
                ]}
              >
                <AppText
                  size={13}
                  weight="semibold"
                  style={{
                    color: on ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {didLabel(did)}
                </AppText>
                <AppText
                  size={11}
                  style={{
                    color: on
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                    marginTop: 2,
                  }}
                >
                  {did.formatted}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {(dids ?? []).length === 0 ? (
          <AppText muted size={13} style={{ marginBottom: spacing.lg }}>
            Sync messages first so your Voip.ms numbers appear here.
          </AppText>
        ) : null}

        <TextField
          label="To"
          value={toRaw}
          onChangeText={setToRaw}
          keyboardType="phone-pad"
          placeholder="(407) 555-0100"
        />
        <TextField
          label={`Message (${body.length}/160)`}
          value={body}
          onChangeText={(t) => setBody(t.slice(0, 160))}
          placeholder="Type your message…"
          multiline
        />
        <Button
          label={sending ? "Sending…" : "Send"}
          loading={sending}
          disabled={sending}
          onPress={() => void onSend()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  didRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  didChip: {
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 120,
  },
});
