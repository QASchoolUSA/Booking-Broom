import React from "react";
import { useLocalSearchParams } from "expo-router";
import { EmailThreadConversation } from "@/components/email/EmailThreadConversation";
import { EmptyState, Screen } from "@/components/ui";
import type { Id } from "@/lib/api";

export default function EmailThreadScreen() {
  const { threadId, subject } = useLocalSearchParams<{
    threadId: string;
    subject?: string;
  }>();

  if (!threadId) {
    return (
      <Screen>
        <EmptyState title="Thread not found" />
      </Screen>
    );
  }

  return (
    <EmailThreadConversation
      threadId={threadId as Id<"emailThreads">}
      subject={subject || "(no subject)"}
      useStackHeader
    />
  );
}
