"use client";

import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { EmailMailbox } from "@/lib/types";

interface MailboxSidebarProps {
  mailboxes: EmailMailbox[];
  selectedMailboxId: string | null;
  onSelect: (mailboxId: string | null) => void;
}

export function MailboxSidebar({
  mailboxes,
  selectedMailboxId,
  onSelect,
}: MailboxSidebarProps) {
  const disconnect = useAction(api.emailActions.disconnectMailbox);

  const handleDisconnect = async (
    e: React.MouseEvent,
    box: EmailMailbox
  ) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Disconnect ${box.email}? Synced mail is removed from Booking Broom only.`
      )
    ) {
      return;
    }
    try {
      await disconnect({ mailboxId: box.id as Id<"emailMailboxes"> });
      if (selectedMailboxId === box.id) onSelect(null);
      toast.success("Mailbox disconnected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  };

  return (
    <div className="space-y-1">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Mailboxes
      </p>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
          selectedMailboxId === null
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground hover:bg-muted/60"
        )}
      >
        All sites
      </button>
      {mailboxes.map((box) => {
        const active = selectedMailboxId === box.id;
        return (
          <div key={box.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(box.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 pr-8 text-left transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-muted/60"
              )}
            >
              <span className="flex items-center gap-2 truncate text-sm font-medium">
                {box.site_accent && (
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: box.site_accent }}
                  />
                )}
                <span className="truncate">{box.site_name || box.email}</span>
                {box.status === "error" && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-600">
                    err
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {box.email}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => handleDisconnect(e, box)}
              className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
              aria-label={`Disconnect ${box.email}`}
              title="Disconnect"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        );
      })}
      {mailboxes.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Connect a SpaceMail mailbox to get started.
        </p>
      )}
    </div>
  );
}
