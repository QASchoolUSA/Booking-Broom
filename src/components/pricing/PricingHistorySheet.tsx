"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import type { SitePricingHistoryEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface PricingHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteName: string;
  currentVersion: number;
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PricingHistorySheet({
  open,
  onOpenChange,
  siteId,
  siteName,
  currentVersion,
}: PricingHistorySheetProps) {
  const historyRaw = useQuery(
    api.pricing.listHistory,
    open ? { siteId: siteId as Id<"sites"> } : "skip"
  );
  const history = (historyRaw ?? []) as SitePricingHistoryEntry[];
  const loading = open && historyRaw === undefined;
  const revertToVersion = useMutation(api.pricing.revertToVersion);
  const [reverting, setReverting] = useState<number | null>(null);

  const handleRevert = async (version: number) => {
    setReverting(version);
    try {
      await revertToVersion({
        siteId: siteId as Id<"sites">,
        version,
      });
      toast.success(`Restored ${siteName} to v${version}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revert");
    } finally {
      setReverting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b px-4 pb-4 pt-4 pr-12">
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Past saves for {siteName}. Reverting creates a new version from that
            snapshot.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No previous versions yet. Saves appear here after the first change.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => {
                const isCurrent = entry.version === currentVersion;
                return (
                  <li
                    key={entry.id}
                    className="rounded-lg border bg-background px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums">
                          v{entry.version}
                          {isCurrent && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              current
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entry.summary || "Saved"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatWhen(entry.changed_at)}
                        </p>
                      </div>
                      {!isCurrent && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5"
                          disabled={reverting !== null}
                          onClick={() => handleRevert(entry.version)}
                        >
                          <ArrowCounterClockwise size={13} />
                          {reverting === entry.version
                            ? "Reverting…"
                            : "Revert"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
