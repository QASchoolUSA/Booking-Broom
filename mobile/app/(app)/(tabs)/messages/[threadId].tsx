import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SmsConversation } from "@/components/messages/SmsConversation";
import { EmptyState, Screen } from "@/components/ui";
import { decodeSmsThreadId } from "@/lib/smsThreadId";

export default function MessagesThreadScreen() {
  const { threadId, title } = useLocalSearchParams<{
    threadId: string;
    title?: string;
  }>();
  const decoded = threadId ? decodeSmsThreadId(threadId) : null;

  if (!decoded) {
    return (
      <Screen>
        <EmptyState title="Conversation not found" />
      </Screen>
    );
  }

  return (
    <SmsConversation
      did={decoded.did}
      contact={decoded.contact}
      title={title || decoded.contact}
      useStackHeader
    />
  );
}
