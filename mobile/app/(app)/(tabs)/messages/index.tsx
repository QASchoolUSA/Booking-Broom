import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Plus } from "lucide-react-native";
import { VirtualList } from "@/components/ui/VirtualList";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppText,
  Button,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { SwipeToDeleteRow } from "@/components/ui/SwipeToDeleteRow";
import { SmsConversation } from "@/components/messages/SmsConversation";
import { api } from "@/lib/api";
import { encodeSmsThreadId } from "@/lib/smsThreadId";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

export type SmsThread = {
  did: string;
  contact: string;
  contact_formatted: string;
  label: string | null;
  last_body: string;
  last_sent_at: string;
  last_direction: "in" | "out";
  did_formatted: string;
};

export default function MessagesIndexScreen() {
  const { colors, isTablet } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const threads = useQuery(api.sms.listThreads, isAuthenticated ? {} : "skip");
  const syncMessages = useAction(api.voipmsActions.syncMessagesNow);
  const deleteConversation = useMutation(api.sms.deleteConversation);

  const [active, setActive] = useState<SmsThread | null>(null);
  const [syncing, setSyncing] = useState(false);

  const threadList = useMemo(() => (threads ?? []) as SmsThread[], [threads]);

  const openThread = (t: SmsThread) => {
    if (isTablet) {
      setActive(t);
      return;
    }
    router.push(
      `/messages/${encodeSmsThreadId(t.did, t.contact)}?title=${encodeURIComponent(
        t.label || t.contact_formatted
      )}` as Href
    );
  };

  const confirmDeleteConversation = (t: SmsThread) => {
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
              await deleteConversation({
                did: t.did,
                contact: t.contact,
              });
              if (
                active &&
                active.did === t.did &&
                active.contact === t.contact
              ) {
                setActive(null);
              }
            })();
          },
        },
      ]
    );
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      await syncMessages({});
    } finally {
      setSyncing(false);
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => router.push("/messages/compose" as Href)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New message"
            style={[
              styles.iconBtn,
              { backgroundColor: colors.muted },
            ]}
          >
            <Plus size={20} color={colors.primary} />
          </Pressable>
          <Button
            label={syncing ? "Syncing…" : "Sync"}
            variant="secondary"
            onPress={onSync}
            disabled={syncing}
            style={{ minHeight: 40, paddingHorizontal: 14 }}
          />
        </View>
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
            <SwipeToDeleteRow
              onDelete={() => confirmDeleteConversation(item)}
            >
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
            <SmsConversation
              did={active.did}
              contact={active.contact}
              title={active.label || active.contact_formatted}
              showBack={false}
              onDeleted={() => setActive(null)}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <EmptyState title="Select a conversation" />
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
    gap: 6,
  },
  threadTop: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  split: { flex: 1, flexDirection: "row" },
  pane: { width: 340, borderRightWidth: StyleSheet.hairlineWidth },
});
