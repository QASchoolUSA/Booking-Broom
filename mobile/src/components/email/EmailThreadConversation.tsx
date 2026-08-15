import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { EmailMessageCard } from "@/components/email/EmailMessageCard";
import { VirtualList } from "@/components/ui/VirtualList";
import { AppText, Button, LoadingBlock } from "@/components/ui";
import { api, type Id } from "@/lib/api";
import { useTheme } from "@/theme";
import { spacing } from "@/theme/tokens";

type Msg = {
  id: string;
  from: string;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  sent_at: string;
  direction: "in" | "out";
  attachments?: Array<{
    filename: string;
    size?: number;
    skipped?: boolean;
  }>;
};

export type EmailThreadConversationProps = {
  threadId: Id<"emailThreads">;
  subject: string;
  showBack?: boolean;
  onDeleted?: () => void;
  useStackHeader?: boolean;
};

export function EmailThreadConversation({
  threadId,
  subject,
  showBack = false,
  onDeleted,
  useStackHeader = false,
}: EmailThreadConversationProps) {
  const { colors, isTablet } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const threadListRef = useRef<FlatList<Msg>>(null);
  const sendReply = useAction(api.emailActions.sendReply);
  const markSeen = useAction(api.emailActions.markSeen);
  const markLocal = useMutation(api.email.markThreadReadLocal);
  const deleteThread = useMutation(api.email.deleteThread);

  const messages = useQuery(
    api.email.listMessages,
    isAuthenticated ? { threadId } : "skip"
  );

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);

  useEffect(() => {
    void markLocal({ threadId });
    void markSeen({ threadId }).catch(() => undefined);
  }, [threadId, markLocal, markSeen]);

  const onSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendReply({ threadId, text: draft.trim() });
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const confirmDeleteThread = () => {
    Alert.alert(
      "Delete thread?",
      "Removes this conversation from Booking Broom. Mail on the provider is unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingThread(true);
              try {
                await deleteThread({ threadId });
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
      onPress={confirmDeleteThread}
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
            title: subject || "(no subject)",
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
            numberOfLines={2}
            style={styles.headerTitle}
          >
            {subject || "(no subject)"}
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
            ref={threadListRef}
            style={{ flex: 1 }}
            data={(messages ?? []) as Msg[]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => (
              <EmailMessageCard
                from={item.from}
                subject={item.subject}
                sentAt={item.sent_at}
                textBody={item.text_body}
                htmlBody={item.html_body}
                attachments={item.attachments}
              />
            )}
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
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Reply…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            onFocus={() => {
              requestAnimationFrame(() => {
                threadListRef.current?.scrollToEnd({ animated: true });
              });
            }}
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          <Button label="Send" onPress={onSend} loading={sending} />
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
  composer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
    textAlignVertical: "top",
  },
});
