"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { DidSidebar } from "@/components/messages/DidSidebar";
import { DidFilterChips } from "@/components/messages/DidFilterChips";
import { SmsSyncBanner } from "@/components/messages/SmsSyncBanner";
import { ThreadList } from "@/components/messages/ThreadList";
import { ConversationView } from "@/components/messages/ConversationView";
import type { SmsDid, SmsMessage, SmsSyncState, SmsThread } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  const showInbox = dids.length > 0 || Boolean(syncState);
  const mobileInThread = Boolean(selectedThread);

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="Messages"
      contentWidth="full"
      hideMobileNav={mobileInThread}
      hideMobileNavPad
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
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Desktop title + sync */}
        <div className="hidden shrink-0 space-y-3 border-b border-border/60 px-6 py-4 md:block lg:px-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Messages</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              SMS and MMS from your Voip.ms numbers
            </p>
          </div>
          <SmsSyncBanner syncState={syncState} hasDids={dids.length > 0} />
        </div>

        {!showInbox ? (
          <div className="flex flex-1 flex-col justify-center px-4 py-6 md:px-6">
            <SmsSyncBanner syncState={syncState} hasDids={false} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* List pane — hidden on mobile when a thread is open */}
            <div
              className={cn(
                "flex min-h-0 w-full flex-col border-border md:w-[340px] md:shrink-0 md:border-r lg:w-[360px]",
                mobileInThread ? "hidden md:flex" : "flex"
              )}
            >
              <div className="shrink-0 space-y-3 border-b border-border px-4 py-3 md:hidden">
                <SmsSyncBanner
                  syncState={syncState}
                  hasDids={dids.length > 0}
                  compact
                />
                <DidFilterChips
                  dids={dids}
                  selectedDid={selectedDid}
                  onSelect={(did) => {
                    setSelectedDid(did);
                    setSelectedThread(null);
                  }}
                />
              </div>

              <div className="hidden shrink-0 border-b border-border px-4 py-2.5 md:block">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Conversations
                  {selectedDid
                    ? ` · ${dids.find((d) => d.did === selectedDid)?.description || selectedDid}`
                    : ""}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
                <ThreadList
                  threads={threads}
                  selectedKey={selectedKey}
                  onSelect={setSelectedThread}
                />
              </div>
            </div>

            {/* Chat pane — full screen on mobile when thread selected */}
            <div
              className={cn(
                "min-h-0 flex-1 flex-col",
                mobileInThread ? "flex" : "hidden md:flex"
              )}
            >
              <ConversationView
                thread={selectedThread}
                messages={messages}
                onBack={() => setSelectedThread(null)}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
