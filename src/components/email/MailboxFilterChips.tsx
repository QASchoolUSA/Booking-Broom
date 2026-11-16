"use client";

import { cn } from "@/lib/utils";
import type { EmailMailbox } from "@/lib/types";

export const ALL_MAILBOXES_ID = "__all__";

interface MailboxFilterChipsProps {
  mailboxes: EmailMailbox[];
  selectedMailboxId: string | null;
  onSelect: (mailboxId: string) => void;
  totalUnread?: number;
}

export function MailboxFilterChips({
  mailboxes,
  selectedMailboxId,
  onSelect,
  totalUnread = 0,
}: MailboxFilterChipsProps) {
  const allActive =
    selectedMailboxId === ALL_MAILBOXES_ID || selectedMailboxId === null;

  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onSelect(ALL_MAILBOXES_ID)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          allActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        <span>All</span>
        {totalUnread > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              allActive
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary text-primary-foreground"
            )}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
      {mailboxes.map((box) => {
        const active = selectedMailboxId === box.id;
        const unread = box.unread_count > 0;
        return (
          <button
            key={box.id}
            type="button"
            onClick={() => onSelect(box.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {box.site_accent && (
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: active ? "currentColor" : box.site_accent,
                  opacity: active ? 0.85 : 1,
                }}
              />
            )}
            <span className="truncate max-w-[9rem]">
              {box.site_name || box.email.split("@")[0]}
            </span>
            {unread && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {box.unread_count > 99 ? "99+" : box.unread_count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
