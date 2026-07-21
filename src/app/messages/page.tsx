"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { DidSidebar } from "@/components/messages/DidSidebar";
import { SmsSyncBanner } from "@/components/messages/SmsSyncBanner";
import { ThreadList } from "@/components/messages/ThreadList";
import { ConversationView } from "@/components/messages/ConversationView";
import type { SmsDid, SmsMessage, SmsSyncState, SmsThread } from "@/lib/types";

export default function MessagesPage() {
  const { connectionState } = useBookings();
  const { isAuthenticated } = useConvexAuth();
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<SmsThread | null>(null);

  const syncState = useQuery(
    api.sms.getSyncState,
    isAuthenticated ? {} : "skip"
  ) as SmsSyncState | null | undefined;

  const didsRaw = useQuery(api.sms.listDids, isAuthenticated ? {} : "skip");
  const dids = (didsRaw ?? []) as SmsDid[];

  const threadsRaw = useQuery(
    api.sms.listThreads,
    isAuthenticated
      ? selectedDid
        ? { did: selectedDid }
        : {}
      : "skip"
  );
  const threads = (threadsRaw ?? []) as SmsThread[];

  const messagesRaw = useQuery(
    api.sms.listMessages,
    isAuthenticated && selectedThread
      ? { did: selectedThread.did, contact: selectedThread.contact }
      : "skip"
  );
  const messages = messagesRaw as SmsMessage[] | undefined;

  const selectedKey = useMemo(
    () =>
      selectedThread
        ? `${selectedThread.did}:${selectedThread.contact}`
        : null,
    [selectedThread]
  );

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="Messages"
      sidebar={
        <DidSidebar
          dids={dids}
          selectedDid={selectedDid}
          onSelect={(did) => {
            setSelectedDid(did);
            setSelectedThread(null);
          }}
        />
      }
    >
      <div className="space-y-4">
        <div className="hidden md:block">
          <h2 className="text-2xl font-bold tracking-tight">Messages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            SMS and MMS from your Voip.ms numbers — filter by line, reply by text
          </p>
        </div>

        <SmsSyncBanner syncState={syncState} hasDids={dids.length > 0} />

        {(dids.length > 0 || syncState) && (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="grid min-h-[420px] md:grid-cols-[minmax(240px,320px)_1fr]">
              <div className="border-b border-border md:border-b-0 md:border-r">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Conversations
                    {selectedDid
                      ? ` · ${dids.find((d) => d.did === selectedDid)?.description || selectedDid}`
                      : ""}
                  </p>
                </div>
                <ThreadList
                  threads={threads}
                  selectedKey={selectedKey}
                  onSelect={setSelectedThread}
                />
              </div>
              <ConversationView thread={selectedThread} messages={messages} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
