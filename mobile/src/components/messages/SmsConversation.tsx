import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUp, Trash2 } from "lucide-react-native";
import { VirtualList } from "@/components/ui/VirtualList";
import { AppText, LoadingBlock } from "@/components/ui";
import { api, type Id } from "@/lib/api";
import {
  MMS_TEXT_MAX,
  messageLengthLabel,
} from "@/lib/messageLimits";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

type Msg = {
  id: string;
  body: string;
  direction: "in" | "out";
  sent_at: string;
};

export type SmsConversationProps = {
  did: string;
  contact: string;
  title: string;
  showBack?: boolean;
  onDeleted?: () => void;
  /** When true, stack header is used instead of in-screen header. */
  useStackHeader?: boolean;
};

export function SmsConversation({
  did,
  contact,
  title,
  showBack = false,
  onDeleted,
  useStackHeader = false,
}: SmsConversationProps) {
  const { colors, isTablet } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const sendMessage = useAction(api.voipmsActions.sendMessage);
  const deleteMessage = useMutation(api.sms.deleteMessage);
  const deleteConversation = useMutation(api.sms.deleteConversation);

  const messages = useQuery(
    api.sms.listMessages,
    isAuthenticated ? { did, contact } : "skip"
  );

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [deletingThread, setDeletingThread] = useState(false);

  const canSend = draft.trim().length > 0 && !sending;

  const onSend = async () => {
    if (!canSend) return;
    const message = draft.trim();
    if (message.length > MMS_TEXT_MAX) {
      Alert.alert(`Message is limited to ${MMS_TEXT_MAX} characters`);
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        did,
        contact,
        message,
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const confirmDeleteMessage = (msg: Msg) => {
    Alert.alert(
      "Delete message?",
      "This removes the message from Booking Broom.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingMsgId(msg.id);
              try {
                await deleteMessage({
                  messageId: msg.id as Id<"smsMessages">,
                });
              } finally {
                setDeletingMsgId(null);
              }
            })();
          },
        },
      ]
    );
  };

  const confirmDeleteConversation = () => {
    Alert.alert(
      "Delete conversation?",
      "All messages in this thread will be removed from Booking Broom.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingThread(true);
              try {
                await deleteConversation({ did, contact });
                onDeleted?.();
                if (!isTablet && useStackHeader) router.back();
              } finally {
                setDeletingThread(false);
              }
            })();
          },
        },
      ]
    );
  };

  const headerRight = (
    <Pressable
      onPress={confirmDeleteConversation}
      hitSlop={10}
      disabled={deletingThread}
      style={{ paddingHorizontal: 4 }}
    >
      <Trash2
        size={18}
        color={deletingThread ? colors.mutedForeground : colors.destructive}
      />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {useStackHeader ? (
        <Stack.Screen
          options={{
            title,
            headerRight: () => headerRight,
          }}
        />
      ) : (
        <View
          style={[
            styles.convHeader,
            {
              borderBottomColor: colors.border,
              paddingTop: spacing.md,
              backgroundColor: colors.background,
            },
          ]}
        >
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={styles.headerSide}
            >
              <AppText weight="semibold" style={{ color: colors.primary }}>
                Back
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.headerSide} />
          )}
          <AppText
            weight="semibold"
            numberOfLines={1}
            style={styles.headerTitle}
          >
            {title}
          </AppText>
          <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
            {headerRight}
          </View>
        </View>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        automaticOffset
      >
        {messages === undefined ? (
          <LoadingBlock />
        ) : (
          <VirtualList
            style={{ flex: 1 }}
            data={(messages as Msg[]).slice().reverse()}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            renderItem={({ item }) => {
              const mine = item.direction === "out";
              const deleting = deletingMsgId === item.id;
              return (
                <Pressable
                  onLongPress={() => confirmDeleteMessage(item)}
                  delayLongPress={350}
                  style={[
                    styles.bubble,
                    {
                      alignSelf: mine ? "flex-end" : "flex-start",
                      backgroundColor: mine ? colors.primary : colors.muted,
                      marginBottom: spacing.sm,
                      opacity: deleting ? 0.5 : 1,
                    },
                  ]}
                >
                  <AppText
                    size={14}
                    style={{
                      color: mine
                        ? colors.primaryForeground
                        : colors.foreground,
                    }}
                  >
                    {item.body}
                  </AppText>
                </Pressable>
              );
            }}
          />
        )}
        <View
          style={[
            styles.composer,
            {
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.sm),
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <TextInput
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, MMS_TEXT_MAX))}
              placeholder="Message"
              placeholderTextColor={colors.mutedForeground}
              maxLength={MMS_TEXT_MAX}
              multiline
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
            <AppText muted size={11}>
              {messageLengthLabel(draft.length)}
            </AppText>
          </View>
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend
                  ? colors.primary
                  : colors.mutedForeground,
                opacity: canSend ? 1 : 0.45,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator
                size="small"
                color={colors.primaryForeground}
              />
            ) : (
              <ArrowUp
                size={20}
                color={colors.primaryForeground}
                strokeWidth={2.6}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  convHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  headerSide: {
    width: 64,
    zIndex: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
});
