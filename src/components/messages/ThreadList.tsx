"use client";

import { formatDistanceToNow } from "date-fns";
import { Image as ImageIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { SmsThread } from "@/lib/types";

interface ThreadListProps {
  threads: SmsThread[];
  selectedKey: string | null;
  onSelect: (thread: SmsThread) => void;
}

function threadKey(t: SmsThread) {
  return `${t.did}:${t.contact}`;
}

export function ThreadList({
  threads,
  selectedKey,
  onSelect,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        No conversations yet. Sync messages or wait for an inbound SMS.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {threads.map((thread) => {
        const key = threadKey(thread);
        const active = selectedKey === key;
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(thread)}
              className={cn(
                "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                active ? "bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">
                  {thread.contact_formatted}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(thread.last_sent_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                via {thread.did_description || thread.did_formatted}
                {thread.sub_account ? ` · ${thread.sub_account}` : ""}
              </p>
              <p className="flex items-center gap-1 truncate text-sm text-foreground/80">
                {thread.has_media && (
                  <ImageIcon size={14} className="shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">
                  {thread.last_direction === "out" ? "You: " : ""}
                  {thread.last_body || (thread.has_media ? "Media" : "")}
                </span>
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
