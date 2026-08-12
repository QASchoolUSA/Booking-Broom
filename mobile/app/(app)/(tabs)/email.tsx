import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VirtualList } from "@/components/ui/VirtualList";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChrome } from "@/components/chrome/ChromeContext";
import {
  MailboxChips,
  type MailboxChip,
} from "@/components/email/MailboxChips";
import {
  AppText,
  Badge,
  Button,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { api, type Id } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

const MAILBOX_STORAGE_KEY = "bb.email.selectedMailbox";

type Thread = {
  id: Id<"emailThreads">;
  subject: string;
  participants: string[];
  last_snippet: string;
  last_message_at: string;
  unread_count: number;
  site_name: string | null;
  mailbox_id: Id<"emailMailboxes">;
};

type Msg = {
  id: string;
  from: string;
  text_body: string | null;
  subject: string;
  sent_at: string;
  direction: "in" | "out";
};

function pickDefaultMailbox(mailboxes: MailboxChip[], stored: string | null) {
  if (mailboxes.length === 0) return null;
  if (stored && mailboxes.some((m) => m.id === stored)) return stored;
  const withUnread = mailboxes.find((m) => m.unread_count > 0);
  return withUnread?.id ?? mailboxes[0]!.id;
}

export default function EmailScreen() {
  const { colors, isTablet } = useTheme();
  const insets = useSafeAreaInsets();
  const { setHideTabBar } = useChrome();
  const { isAuthenticated } = useConvexAuth();
  const mailboxesRaw = useQuery(
    api.email.listMailboxes,
    isAuthenticated ? {} : "skip"
  );
  const syncMailbox = useAction(api.emailActions.syncMailboxNow);
  const sendReply = useAction(api.emailActions.sendReply);
  const markSeen = useAction(api.emailActions.markSeen);
  const markLocal = useMutation(api.email.markThreadReadLocal);

  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(
    null
  );
  const [storageReady, setStorageReady] = useState(false);
  const [active, setActive] = useState<Thread | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const mailboxes = useMemo(
    () => (mailboxesRaw ?? []) as MailboxChip[],
    [mailboxesRaw]
  );

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(MAILBOX_STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      setSelectedMailboxId(stored);
      setStorageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (mailboxes.length === 0) {
      if (selectedMailboxId !== null) setSelectedMailboxId(null);
      return;
    }
    const stillValid =
      selectedMailboxId &&
      mailboxes.some((m) => m.id === selectedMailboxId);
    if (stillValid) return;
    const next = pickDefaultMailbox(mailboxes, selectedMailboxId);
    if (next) {
      setSelectedMailboxId(next);
      void AsyncStorage.setItem(MAILBOX_STORAGE_KEY, next);
    }
  }, [mailboxes, selectedMailboxId, storageReady]);

  const selectMailbox = (id: string) => {
    setSelectedMailboxId(id);
    void AsyncStorage.setItem(MAILBOX_STORAGE_KEY, id);
    setActive(null);
    setSheetVisible(false);
    setDraft("");
  };

  const threads = useQuery(
    api.email.listThreads,
    isAuthenticated && selectedMailboxId
      ? { mailboxId: selectedMailboxId as Id<"emailMailboxes"> }
      : "skip"
  );

  const messages = useQuery(
    api.email.listMessages,
    active && isAuthenticated ? { threadId: active.id } : "skip"
  );

  useEffect(() => {
    setHideTabBar(sheetVisible && !isTablet);
    return () => setHideTabBar(false);
  }, [sheetVisible, isTablet, setHideTabBar]);

  useEffect(() => {
    if (!active) return;
    void markLocal({ threadId: active.id });
    void markSeen({ threadId: active.id }).catch(() => undefined);
  }, [active, markLocal, markSeen]);

  const threadList = useMemo(() => (threads ?? []) as Thread[], [threads]);

  const openThread = (t: Thread) => {
    setActive(t);
    setSheetVisible(true);
  };

  const requestCloseThread = () => {
    setSheetVisible(false);
    if (Platform.OS === "android") {
      setActive(null);
      setDraft("");
      setHideTabBar(false);
    }
  };

  const onThreadDismiss = () => {
    setActive(null);
    setDraft("");
    setHideTabBar(false);
  };

  const onSync = async () => {
    if (!selectedMailboxId) return;
    setSyncing(true);
    try {
      await syncMailbox({
        mailboxId: selectedMailboxId as Id<"emailMailboxes">,
      });
    } finally {
      setSyncing(false);
    }
  };

  const onSend = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      await sendReply({ threadId: active.id, text: draft.trim() });
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  if (mailboxesRaw === undefined || !storageReady) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  const listPane = (
    <View style={{ flex: 1 }}>
      <View
        style={[
          styles.topBar,
          { paddingTop: isTablet ? spacing.md : insets.top + spacing.sm },
        ]}
      >
        <AppText weight="bold" size={20}>
          Email
        </AppText>
        <Button
          label={syncing ? "Syncing…" : "Sync"}
          variant="secondary"
          onPress={onSync}
          disabled={syncing || !selectedMailboxId}
          style={{ minHeight: 40, paddingHorizontal: 14 }}
        />
      </View>
      <MailboxChips
        mailboxes={mailboxes}
        selectedMailboxId={selectedMailboxId}
        onSelect={selectMailbox}
      />
      {mailboxes.length === 0 ? (
        <EmptyState
          title="No mailboxes"
          subtitle="Connect a mailbox on the web Email page, then sync."
        />
      ) : threads === undefined ? (
        <LoadingBlock />
      ) : threadList.length === 0 ? (
        <EmptyState
          title="No threads"
          subtitle="This inbox is empty. Tap Sync to fetch mail."
        />
      ) : (
        <VirtualList
          data={threadList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 100,
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openThread(item)}
              style={[
                styles.thread,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.threadTop}>
                <AppText weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                  {item.subject || "(no subject)"}
                </AppText>
                {item.unread_count > 0 ? (
                  <Badge label={String(item.unread_count)} tone="accent" />
                ) : null}
              </View>
              <AppText muted size={12} numberOfLines={1}>
                {item.participants[0] ?? "Mailbox"}
              </AppText>
              <AppText muted size={13} numberOfLines={2}>
                {item.last_snippet}
              </AppText>
              <AppText muted size={11}>
                {formatDistanceToNow(new Date(item.last_message_at), {
                  addSuffix: true,
                })}
              </AppText>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );

  const conversation = active ? (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.convHeader,
          {
            borderBottomColor: colors.border,
            paddingTop: isTablet ? spacing.md : spacing.md,
            backgroundColor: colors.background,
          },
        ]}
      >
        {!isTablet ? (
          <Pressable
            onPress={requestCloseThread}
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
          {active.subject || "(no subject)"}
        </AppText>
        {!isTablet ? <View style={styles.headerSide} /> : null}
      </View>
      <VirtualList
        data={(messages ?? []) as Msg[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.msg,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText weight="medium" size={13}>
              {item.from}
            </AppText>
            <AppText muted size={11} style={{ marginTop: 2 }}>
              {formatDistanceToNow(new Date(item.sent_at), { addSuffix: true })}
            </AppText>
            <AppText style={{ marginTop: spacing.sm }} size={14}>
              {item.text_body || "(no text body)"}
            </AppText>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
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
  ) : (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState title="Select a thread" />
    </View>
  );

  if (isTablet) {
    return (
      <View style={[styles.split, { backgroundColor: colors.background }]}>
        <View style={[styles.pane, { borderRightColor: colors.border }]}>
          {listPane}
        </View>
        <View style={{ flex: 1 }}>{conversation}</View>
      </View>
    );
  }

  return (
    <Screen padded={false}>
      {listPane}
      <Modal
        visible={sheetVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={requestCloseThread}
        onDismiss={onThreadDismiss}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {conversation}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  thread: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  threadTop: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  split: { flex: 1, flexDirection: "row" },
  pane: { width: 360, borderRightWidth: StyleSheet.hairlineWidth },
  convHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: "relative",
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
  msg: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
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
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
    textAlignVertical: "top",
  },
});
