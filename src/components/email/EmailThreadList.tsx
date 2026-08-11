"use client";

import { formatDistanceToNow } from "date-fns";
import { Paperclip } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { EmailThread } from "@/lib/types";
import { EmailThreadListSkeleton } from "@/components/loading/skeletons";

interface EmailThreadListProps {
  threads: EmailThread[];
  selectedId: string | null;
  onSelect: (thread: EmailThread) => void;
  siteName?: string | null;
  loading?: boolean;
}

export function EmailThreadList({
  threads,
  selectedId,
  onSelect,
  siteName,
  loading = false,
}: EmailThreadListProps) {
  if (loading) {
    return <EmailThreadListSkeleton />;
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
        {siteName
          ? `No mail for ${siteName} yet.`
          : "No conversations yet. Sync the mailbox or wait for inbound email."}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {threads.map((thread) => {
        const active = selectedId === thread.id;
        const unread = thread.unread_count > 0;
        const fromLabel =
          thread.participants.filter(
            (p) =>
              p &&
              (!thread.mailbox_email ||
                p.toLowerCase() !== thread.mailbox_email.toLowerCase())
          )[0] ??
          thread.participants[0] ??
          "Unknown";
        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelect(thread)}
              className={cn(
                "flex w-full flex-col gap-0.5 px-4 py-3.5 text-left transition-colors active:bg-muted/70",
                active ? "bg-primary/8 md:bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-[15px]",
                    unread
                      ? "font-bold text-foreground"
                      : "font-semibold text-foreground"
                  )}
                >
                  {thread.subject || "(no subject)"}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(thread.last_message_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {fromLabel}
                {unread ? ` · ${thread.unread_count} unread` : ""}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-foreground/75">
                {thread.last_snippet.includes("📎") && (
                  <Paperclip
                    size={14}
                    className="shrink-0 text-muted-foreground"
                  />
                )}
                <span className="truncate">{thread.last_snippet || " "}</span>
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
