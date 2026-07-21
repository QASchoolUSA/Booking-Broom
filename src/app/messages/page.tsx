"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Plus } from "@phosphor-icons/react";
import { useBookings } from "@/lib/hooks/useBookings";
import {
  useIsMobileMd,
  useVisualViewportHeight,
} from "@/lib/hooks/useVisualViewportHeight";
import { AppShell } from "@/components/layout/AppShell";
import { DidSidebar } from "@/components/messages/DidSidebar";
import { DidFilterChips } from "@/components/messages/DidFilterChips";
import { SmsSyncBanner } from "@/components/messages/SmsSyncBanner";
import { ThreadList } from "@/components/messages/ThreadList";
import { ConversationView } from "@/components/messages/ConversationView";
import { ComposeMessageSheet } from "@/components/messages/ComposeMessageSheet";
import type { SmsDid, SmsMessage, SmsSyncState, SmsThread } from "@/lib/types";
import { didDisplayLabel } from "@/lib/smsLabels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function MessagesPage() {
  const { connectionState } = useBookings();
  const { isAuthenticated } = useConvexAuth();
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const isMobile = useIsMobileMd();

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

  const selectedThread = useMemo(
    () =>
      selectedKey
        ? (threads.find((t) => `${t.did}:${t.contact}` === selectedKey) ?? null)
        : null,
    [threads, selectedKey]
  );

  const messagesRaw = useQuery(
    api.sms.listMessages,
    isAuthenticated && selectedKey
      ? {
          did: selectedKey.split(":")[0]!,
          contact: selectedKey.split(":")[1]!,
        }
      : "skip"
  );
  const messages = messagesRaw as SmsMessage[] | undefined;

  const showInbox = dids.length > 0 || Boolean(syncState);
  const mobileInThread = Boolean(selectedKey);
  const vv = useVisualViewportHeight(isMobile && mobileInThread);

  // Only constrain height while the keyboard is open — otherwise flex/dvh owns sizing.
  const threadPaneStyle =
    vv?.keyboardOpen && isMobile && mobileInThread
      ? ({ height: vv.height, maxHeight: vv.height } as const)
      : undefined;

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="Messages"
      contentWidth="full"
      hideMobileNav={mobileInThread}
      hideMobileHeader={mobileInThread}
      hideMobileNavPad
      sidebar={
        <DidSidebar
          dids={dids}
          selectedDid={selectedDid}
          onSelect={(did) => {
            setSelectedDid(did);
            setSelectedKey(null);
          }}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Desktop title + sync */}
        <div className="hidden shrink-0 space-y-3 border-b border-border/60 px-6 py-4 md:block lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Messages</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                SMS and MMS from your Voip.ms numbers
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setComposeOpen(true)}
              disabled={dids.length === 0}
            >
              <Plus size={16} weight="bold" />
              New message
            </Button>
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
                <div className="flex items-center justify-between gap-2">
                  <SmsSyncBanner
                    syncState={syncState}
                    hasDids={dids.length > 0}
                    compact
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setComposeOpen(true)}
                    disabled={dids.length === 0}
                    aria-label="New message"
                  >
                    <Plus size={18} weight="bold" />
                  </Button>
                </div>
                <DidFilterChips
                  dids={dids}
                  selectedDid={selectedDid}
                  onSelect={(did) => {
                    setSelectedDid(did);
                    setSelectedKey(null);
                  }}
                />
              </div>

              <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5 md:flex">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Conversations
                  {selectedDid
                    ? (() => {
                        const d = dids.find((x) => x.did === selectedDid);
                        return d ? ` · ${didDisplayLabel(d)}` : "";
                      })()
                    : ""}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs"
                  onClick={() => setComposeOpen(true)}
                  disabled={dids.length === 0}
                >
                  <Plus size={14} weight="bold" />
                  New
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
                <ThreadList
                  threads={threads}
                  selectedKey={selectedKey}
                  onSelect={(thread) =>
                    setSelectedKey(`${thread.did}:${thread.contact}`)
                  }
                />
              </div>
            </div>

            {/* Chat pane — normal-flow flex; VV height only while keyboard is open */}
            <div
              className={cn(
                "min-h-0 flex-1 flex-col overflow-hidden",
                mobileInThread ? "flex" : "hidden md:flex"
              )}
              style={threadPaneStyle}
            >
              <ConversationView
                thread={
                  selectedThread ??
                  (selectedKey
                    ? ({
                        did: selectedKey.split(":")[0]!,
                        contact: selectedKey.split(":")[1]!,
                        did_description: "",
                        did_formatted: selectedKey.split(":")[0]!,
                        sub_account: null,
                        contact_formatted: selectedKey.split(":")[1]!,
                        label: null,
                        note: null,
                        last_body: "",
                        last_sent_at: new Date().toISOString(),
                        last_direction: "out",
                        last_type: "sms",
                        has_media: false,
                      } satisfies SmsThread)
                    : null)
                }
                messages={messages}
                onBack={() => setSelectedKey(null)}
                onConversationDeleted={() => setSelectedKey(null)}
                keyboardOpen={Boolean(vv?.keyboardOpen)}
                immersiveMobile={mobileInThread}
                className="h-full min-h-0"
              />
            </div>
          </div>
        )}
      </div>

      <ComposeMessageSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        dids={dids}
        defaultDid={selectedDid}
        onSent={(did, contact) => {
          setSelectedDid(null);
          setSelectedKey(`${did}:${contact}`);
        }}
      />
    </AppShell>
  );
}
