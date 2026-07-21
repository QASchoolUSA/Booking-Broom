"use client";

import { cn } from "@/lib/utils";
import type { SmsDid } from "@/lib/types";

interface DidFilterChipsProps {
  dids: SmsDid[];
  selectedDid: string | null;
  onSelect: (did: string | null) => void;
  className?: string;
}

export function DidFilterChips({
  dids,
  selectedDid,
  onSelect,
  className,
}: DidFilterChipsProps) {
  return (
    <div
      className={cn(
        "-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <Chip
        label="All"
        active={selectedDid === null}
        onClick={() => onSelect(null)}
      />
      {dids.map((did) => (
        <Chip
          key={did.id}
          label={did.description || did.formatted}
          active={selectedDid === did.did}
          onClick={() => onSelect(did.did)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
