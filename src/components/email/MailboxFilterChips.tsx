"use client";

import { cn } from "@/lib/utils";
import type { EmailMailbox } from "@/lib/types";

interface MailboxFilterChipsProps {
  mailboxes: EmailMailbox[];
  selectedMailboxId: string | null;
  onSelect: (mailboxId: string | null) => void;
}

export function MailboxFilterChips({
  mailboxes,
  selectedMailboxId,
  onSelect,
}: MailboxFilterChipsProps) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          selectedMailboxId === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        All
      </button>
      {mailboxes.map((box) => (
        <button
          key={box.id}
          type="button"
          onClick={() => onSelect(box.id)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            selectedMailboxId === box.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {box.site_name || box.email.split("@")[0]}
        </button>
      ))}
    </div>
  );
}
