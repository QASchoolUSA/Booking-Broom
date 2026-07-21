"use client";

import { cn } from "@/lib/utils";
import type { SmsDid } from "@/lib/types";

interface DidSidebarProps {
  dids: SmsDid[];
  selectedDid: string | null;
  onSelect: (did: string | null) => void;
}

export function DidSidebar({ dids, selectedDid, onSelect }: DidSidebarProps) {
  return (
    <div className="space-y-1">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Numbers
      </p>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
          selectedDid === null
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground hover:bg-muted/60"
        )}
      >
        All numbers
      </button>
      {dids.map((did) => {
        const active = selectedDid === did.did;
        return (
          <button
            key={did.id}
            type="button"
            onClick={() => onSelect(did.did)}
            className={cn(
              "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-muted/60"
            )}
          >
            <span className="truncate text-sm font-medium">
              {did.description || did.formatted}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {did.formatted}
              {did.sub_account ? ` · ${did.sub_account}` : ""}
            </span>
          </button>
        );
      })}
      {dids.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Sync numbers from Voip.ms to get started.
        </p>
      )}
    </div>
  );
}
