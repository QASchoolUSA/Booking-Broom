"use client";

import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Plus } from "@phosphor-icons/react";
import { useConnectionState } from "@/lib/hooks/useConnectionState";
import {
  useChatVisualViewport,
  useIsMobileMd,
} from "@/lib/hooks/useVisualViewportHeight";
import { useShellPage } from "@/components/layout/ShellChromeContext";
import { MailboxSidebar } from "@/components/email/MailboxSidebar";
import { MailboxFilterChips } from "@/components/email/MailboxFilterChips";
import { EmailSyncBanner } from "@/components/email/EmailSyncBanner";
import { EmailThreadList } from "@/components/email/EmailThreadList";
import { EmailMessageSkeleton } from "@/components/loading/skeletons";
import { ComposeEmailSheet } from "@/components/email/ComposeEmailSheet";
import { ConnectMailboxDialog } from "@/components/email/ConnectMailboxDialog";
import type {
  EmailMailbox,
  EmailMessage,
  EmailSyncState,
  EmailThread,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const EmailThreadView = dynamic(
  () =>
    import("@/components/email/EmailThreadView").then((m) => ({
      default: m.EmailThreadView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <EmailMessageSkeleton />
      </div>
    ),
  }
);

const MAILBOX_STORAGE_KEY = "bb.email.selectedMailbox";

function readStoredMailboxId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MAILBOX_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredMailboxId(id: string) {
  try {
    window.localStorage.setItem(MAILBOX_STORAGE_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

function pickDefaultMailbox(mailboxes: EmailMailbox[]): string | null {
  if (mailboxes.length === 0) return null;
  const stored = readStoredMailboxId();
  if (stored && mailboxes.some((m) => m.id === stored)) return stored;
  const withUnread = mailboxes.find((m) => m.unread_count > 0);
  return withUnread?.id ?? mailboxes[0]!.id;
}

export default function EmailPage() {
  const connectionState = useConnectionState();
  const { isAuthenticated } = useConvexAuth();
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(
    null
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const isMobile = useIsMobileMd();

  const syncState = useQuery(
    api.email.getSyncState,
    isAuthenticated ? {} : "skip"
  ) as EmailSyncState | null | undefined;

  const mailboxesRaw = useQuery(
    api.email.listMailboxes,
    isAuthenticated ? {} : "skip"
  );
  const mailboxes = (mailboxesRaw ?? []) as EmailMailbox[];

  useEffect(() => {
    if (mailboxes.length === 0) {
      if (selectedMailboxId !== null) setSelectedMailboxId(null);
      return;
    }
    const stillValid =
      selectedMailboxId &&
      mailboxes.some((m) => m.id === selectedMailboxId);
    if (stillValid) return;
    const next = pickDefaultMailbox(mailboxes);
    if (next) {
      setSelectedMailboxId(next);
      writeStoredMailboxId(next);
    }
  }, [mailboxes, selectedMailboxId]);

  const selectMailbox = (id: string) => {
    setSelectedMailboxId(id);
    writeStoredMailboxId(id);
    setSelectedThreadId(null);
  };

  const activeMailbox = useMemo(
    () => mailboxes.find((m) => m.id === selectedMailboxId) ?? null,
    [mailboxes, selectedMailboxId]
  );

  const threadsRaw = useQuery(
    api.email.listThreads,
    isAuthenticated && selectedMailboxId
      ? { mailboxId: selectedMailboxId as Id<"emailMailboxes"> }
      : "skip"
  );
  const threads = (threadsRaw ?? []) as EmailThread[];

  const selectedThread = useMemo(
    () =>
      selectedThreadId
        ? (threads.find((t) => t.id === selectedThreadId) ?? null)
        : null,
    [threads, selectedThreadId]
  );

  const messagesRaw = useQuery(
    api.email.listMessages,
    isAuthenticated && selectedThreadId
      ? { threadId: selectedThreadId as Id<"emailThreads"> }
      : "skip"
  );
  const messages = messagesRaw as EmailMessage[] | undefined;

  const showInbox = mailboxes.length > 0;
  const threadsLoading = isAuthenticated && selectedMailboxId
    ? threadsRaw === undefined
    : false;
  const mobileInThread = Boolean(selectedThreadId);
  const iosChatShell = isMobile && mobileInThread;
  const siteLabel =
    activeMailbox?.site_name || activeMailbox?.email || "Email";

  useChatVisualViewport(iosChatShell);

  useShellPage({
    connectionState,
    pageTitle: siteLabel,
    contentWidth: "full",
    hideMobileNav: mobileInThread,
    hideMobileHeader: mobileInThread,
    hideMobileNavPad: true,
    sidebar: (
      <MailboxSidebar
        mailboxes={mailboxes}
        selectedMailboxId={selectedMailboxId}
        onSelect={selectMailbox}
      />
    ),
  });

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="hidden shrink-0 space-y-3 border-b border-border/60 px-6 py-4 md:block lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                {activeMailbox?.site_accent && (
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: activeMailbox.site_accent }}
                  />
                )}
                <h2 className="truncate text-2xl font-bold tracking-tight">
                  {siteLabel}
                </h2>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {activeMailbox
                  ? activeMailbox.email
                  : "Select a site mailbox to read and reply"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConnectOpen(true)}
              >
                Connect
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setComposeOpen(true)}
                disabled={!selectedMailboxId}
              >
                <Plus size={16} weight="bold" />
                New email
              </Button>
            </div>
          </div>
          <EmailSyncBanner
            syncState={syncState}
            hasMailboxes={mailboxes.length > 0}
            mailboxId={selectedMailboxId}
            onConnect={() => setConnectOpen(true)}
          />
        </div>

        {!showInbox ? (
          <div className="flex flex-1 flex-col justify-center px-4 py-6 md:px-6">
            <EmailSyncBanner
              syncState={syncState}
              hasMailboxes={false}
              onConnect={() => setConnectOpen(true)}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div
              className={cn(
                "flex min-h-0 w-full flex-col border-border md:w-[340px] md:shrink-0 md:border-r lg:w-[360px]",
                mobileInThread ? "hidden md:flex" : "flex"
              )}
            >
              <div className="shrink-0 space-y-3 border-b border-border px-4 py-3 md:hidden">
                <div className="flex items-center justify-between gap-2">
                  <EmailSyncBanner
                    syncState={syncState}
                    hasMailboxes={mailboxes.length > 0}
                    mailboxId={selectedMailboxId}
                    onConnect={() => setConnectOpen(true)}
                    compact
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setComposeOpen(true)}
                    disabled={!selectedMailboxId}
                    aria-label="New email"
                  >
                    <Plus size={18} weight="bold" />
                  </Button>
                </div>
                <MailboxFilterChips
                  mailboxes={mailboxes}
                  selectedMailboxId={selectedMailboxId}
                  onSelect={selectMailbox}
                />
              </div>

              <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5 md:flex">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inbox
                  {activeMailbox
                    ? ` · ${activeMailbox.site_name || activeMailbox.email}`
                    : ""}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs"
                  onClick={() => setComposeOpen(true)}
                  disabled={!selectedMailboxId}
                >
                  <Plus size={14} weight="bold" />
                  New
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
                <EmailThreadList
                  threads={threads}
                  selectedId={selectedThreadId}
                  loading={threadsLoading}
                  siteName={activeMailbox?.site_name || activeMailbox?.email}
                  onSelect={(thread) => setSelectedThreadId(thread.id)}
                />
              </div>
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 flex-col overflow-hidden",
                iosChatShell
                  ? "hidden"
                  : mobileInThread
                    ? "flex"
                    : "hidden md:flex"
              )}
            >
              <EmailThreadView
                thread={selectedThread}
                messages={messages}
                onBack={() => setSelectedThreadId(null)}
                onDeleted={() => setSelectedThreadId(null)}
                className="h-full min-h-0"
              />
            </div>
          </div>
        )}
      </div>

      {iosChatShell && (
        <div className="chat-screen md:hidden">
          <EmailThreadView
            thread={selectedThread}
            messages={messages}
            onBack={() => setSelectedThreadId(null)}
            onDeleted={() => setSelectedThreadId(null)}
            immersiveMobile
            className="min-h-0"
          />
        </div>
      )}

      <ComposeEmailSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        mailboxes={mailboxes}
        defaultMailboxId={selectedMailboxId}
        lockMailbox
        onSent={(threadId) => {
          setSelectedThreadId(threadId);
        }}
      />
      <ConnectMailboxDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={(mailboxId) => {
          selectMailbox(mailboxId);
        }}
      />
    </>
  );
}
