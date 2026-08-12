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
import { VirtualList } from "@/components/ui/VirtualList";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChrome } from "@/components/chrome/ChromeContext";
import {
  AppText,
  Button,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

type Thread = {
  did: string;
  contact: string;
  contact_formatted: string;
  label: string | null;
  last_body: string;
  last_sent_at: string;
  last_direction: "in" | "out";
  did_formatted: string;
};

type Msg = {
  id: string;
  body: string;
  direction: "in" | "out";
  sent_at: string;
};

export default function MessagesScreen() {
  const { colors, isTablet } = useTheme();
  const insets = useSafeAreaInsets();
  const { setHideTabBar } = useChrome();
  const { isAuthenticated } = useConvexAuth();
  const threads = useQuery(api.sms.listThreads, isAuthenticated ? {} : "skip");
  const syncMessages = useAction(api.voipmsActions.syncMessagesNow);
  const sendMessage = useAction(api.voipmsActions.sendMessage);

  const [active, setActive] = useState<Thread | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const messages = useQuery(
    api.sms.listMessages,
    active && isAuthenticated
      ? { did: active.did, contact: active.contact }
      : "skip"
  );

  useEffect(() => {
    setHideTabBar(sheetVisible && !isTablet);
    return () => setHideTabBar(false);
  }, [sheetVisible, isTablet, setHideTabBar]);

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
    setSyncing(true);
    try {
      await syncMessages({});
    } finally {
      setSyncing(false);
    }
  };

  const onSend = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        did: active.did,
        contact: active.contact,
        message: draft.trim(),
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  if (threads === undefined) {
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
          Messages
        </AppText>
        <Button
          label={syncing ? "Syncing…" : "Sync"}
          variant="secondary"
          onPress={onSync}
          disabled={syncing}
          style={{ minHeight: 40, paddingHorizontal: 14 }}
        />
      </View>
      {threadList.length === 0 ? (
        <EmptyState
          title="No conversations"
          subtitle="Sync Voip.ms to pull SMS/MMS threads."
        />
      ) : (
        <VirtualList
          data={threadList}
          keyExtractor={(item) => `${item.did}:${item.contact}`}
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
                  {item.label || item.contact_formatted}
                </AppText>
                <AppText muted size={11}>
                  {formatDistanceToNow(new Date(item.last_sent_at), {
                    addSuffix: true,
                  })}
                </AppText>
              </View>
              <AppText muted size={13} numberOfLines={2}>
                {item.last_direction === "out" ? "You: " : ""}
                {item.last_body}
              </AppText>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );

  const title = active
    ? active.label || active.contact_formatted
    : "Conversation";

  const conversation = active ? (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={8}
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
          numberOfLines={1}
          style={styles.headerTitle}
        >
          {title}
        </AppText>
        {!isTablet ? <View style={styles.headerSide} /> : null}
      </View>
      <VirtualList
        data={((messages ?? []) as Msg[]).slice().reverse()}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => {
          const mine = item.direction === "out";
          return (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: mine ? "flex-end" : "flex-start",
                  backgroundColor: mine ? colors.primary : colors.muted,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <AppText
                size={14}
                style={{
                  color: mine ? colors.primaryForeground : colors.foreground,
                }}
              >
                {item.body}
              </AppText>
            </View>
          );
        }}
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
          placeholder="Message"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        />
        <Button
          label="Send"
          onPress={onSend}
          loading={sending}
          style={{ minWidth: 88 }}
        />
      </View>
    </KeyboardAvoidingView>
  ) : (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState title="Select a conversation" />
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
    gap: 6,
  },
  threadTop: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  split: { flex: 1, flexDirection: "row" },
  pane: { width: 340, borderRightWidth: StyleSheet.hairlineWidth },
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
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
  },
});
