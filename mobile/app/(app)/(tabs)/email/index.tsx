import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VirtualList } from "@/components/ui/VirtualList";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MailboxChips,
  type MailboxChip,
} from "@/components/email/MailboxChips";
import { EmailThreadConversation } from "@/components/email/EmailThreadConversation";
import {
  AppText,
  Badge,
  Button,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { SwipeToDeleteRow } from "@/components/ui/SwipeToDeleteRow";
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

function pickDefaultMailbox(mailboxes: MailboxChip[], stored: string | null) {
  if (mailboxes.length === 0) return null;
  if (stored && mailboxes.some((m) => m.id === stored)) return stored;
  const withUnread = mailboxes.find((m) => m.unread_count > 0);
  return withUnread?.id ?? mailboxes[0]!.id;
}

export default function EmailIndexScreen() {
  const { colors, isTablet } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const mailboxesRaw = useQuery(
    api.email.listMailboxes,
    isAuthenticated ? {} : "skip"
  );
  const syncMailbox = useAction(api.emailActions.syncMailboxNow);
  const deleteThread = useMutation(api.email.deleteThread);

  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(
    null
  );
  const [storageReady, setStorageReady] = useState(false);
  const [active, setActive] = useState<Thread | null>(null);
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
  };

  const threads = useQuery(
    api.email.listThreads,
    isAuthenticated && selectedMailboxId
      ? { mailboxId: selectedMailboxId as Id<"emailMailboxes"> }
      : "skip"
  );

  const threadList = useMemo(() => (threads ?? []) as Thread[], [threads]);

  const openThread = (t: Thread) => {
    if (isTablet) {
      setActive(t);
      return;
    }
    router.push(
      `/email/${t.id}?subject=${encodeURIComponent(t.subject || "(no subject)")}` as Href
    );
  };

  const confirmDeleteThread = (t: Thread) => {
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
              await deleteThread({ threadId: t.id });
              if (active?.id === t.id) setActive(null);
            })();
          },
        },
      ]
    );
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
            <SwipeToDeleteRow onDelete={() => confirmDeleteThread(item)}>
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
                  <AppText
                    weight="semibold"
                    numberOfLines={1}
                    style={{ flex: 1 }}
                  >
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
            </SwipeToDeleteRow>
          )}
          ItemSeparatorComponent={() => (
            <View style={{ height: spacing.sm }} />
          )}
        />
      )}
    </View>
  );

  if (isTablet) {
    return (
      <View style={[styles.split, { backgroundColor: colors.background }]}>
        <View style={[styles.pane, { borderRightColor: colors.border }]}>
          {listPane}
        </View>
        <View style={{ flex: 1 }}>
          {active ? (
            <EmailThreadConversation
              threadId={active.id}
              subject={active.subject}
              showBack={false}
              onDeleted={() => setActive(null)}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <EmptyState title="Select a thread" />
            </View>
          )}
        </View>
      </View>
    );
  }

  return <Screen padded={false}>{listPane}</Screen>;
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
});
