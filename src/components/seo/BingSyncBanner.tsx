"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  MagnifyingGlass,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type { BingSyncState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BingSyncBannerProps {
  syncState: BingSyncState | null | undefined;
  hasMetrics: boolean;
}

export function BingSyncBanner({
  syncState,
  hasMetrics,
}: BingSyncBannerProps) {
  const syncNow = useAction(api.bingActions.syncNow);
  const clearMetrics = useMutation(api.bing.clearMetrics);
  const [busy, setBusy] = useState<"sync" | "clear" | null>(null);

  const handleSync = async () => {
    setBusy("sync");
    try {
      await syncNow({});
      toast.success("Bing Webmaster metrics synced");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bing sync failed");
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all stored Bing Webmaster metrics and crawl issues?")) {
      return;
    }
    setBusy("clear");
    try {
      await clearMetrics({});
      toast.success("Bing metrics cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setBusy(null);
    }
  };

  if (syncState === undefined) {
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }

  if (!syncState && !hasMetrics) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MagnifyingGlass size={20} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>Bing Webmaster</CardTitle>
              <CardDescription className="mt-1">
                Sync clicks, impressions, and crawl issues from Bing Webmaster
                Tools. Set{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  BING_WEBMASTER_API_KEY
                </code>{" "}
                in Convex env, then sync.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSync} disabled={busy === "sync"}>
            {busy === "sync" ? "Syncing…" : "Sync Bing metrics"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const syncedLabel = syncState?.last_sync_at
    ? formatDistanceToNow(new Date(syncState.last_sync_at), { addSuffix: true })
    : "Never synced";

  return (
    <Card size="sm" className="shadow-sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">Bing Webmaster</p>
          <p className="text-xs text-muted-foreground">
            Last sync: {syncedLabel}
            {" · "}Daily 06:30 UTC
          </p>
          {syncState?.last_sync_error && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <WarningCircle
                size={14}
                className="mt-0.5 shrink-0"
                weight="fill"
              />
              <span>{syncState.last_sync_error}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={busy !== null}
            className="gap-1.5"
          >
            <ArrowsClockwise
              size={16}
              className={busy === "sync" ? "animate-spin" : undefined}
            />
            {busy === "sync" ? "Syncing…" : "Sync now"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={busy !== null}
            className="gap-1.5 text-muted-foreground"
          >
            <Trash size={16} />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
