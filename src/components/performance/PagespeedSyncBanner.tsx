"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  Gauge,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type { PagespeedSyncState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PagespeedSyncBannerProps {
  syncState: PagespeedSyncState | null | undefined;
  hasMetrics: boolean;
}

export function PagespeedSyncBanner({
  syncState,
  hasMetrics,
}: PagespeedSyncBannerProps) {
  const syncNow = useAction(api.pagespeedActions.syncNow);
  const clearMetrics = useMutation(api.pagespeed.clearMetrics);
  const [busy, setBusy] = useState<"sync" | "clear" | null>(null);

  const handleSync = async () => {
    setBusy("sync");
    try {
      const result = await syncNow({});
      if (result.error) {
        toast.warning("PageSpeed synced with some errors", {
          description: result.error,
        });
      } else {
        toast.success(
          `PageSpeed synced for ${result.sites} site${result.sites === 1 ? "" : "s"}`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PageSpeed sync failed");
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all stored PageSpeed metrics?")) return;
    setBusy("clear");
    try {
      await clearMetrics({});
      toast.success("PageSpeed metrics cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear metrics");
    } finally {
      setBusy(null);
    }
  };

  if (syncState === undefined) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  if (!syncState && !hasMetrics) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gauge size={20} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>PageSpeed Insights</CardTitle>
              <CardDescription className="mt-1">
                Run Lighthouse lab scores and Core Web Vitals for each cleaning
                site (mobile and desktop). Set{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  PAGESPEED_API_KEY
                </code>{" "}
                in Convex env for higher quota, then sync.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSync} disabled={busy === "sync"}>
            {busy === "sync" ? "Running audits…" : "Run PageSpeed for all sites"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const syncedLabel = syncState?.last_sync_at
    ? formatDistanceToNow(new Date(syncState.last_sync_at), { addSuffix: true })
    : "Never synced";

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            PageSpeed Insights
          </p>
          <p className="text-xs text-muted-foreground">
            Last sync: {syncedLabel}
            {" · "}Weekly Monday 07:00 UTC
          </p>
          {syncState?.last_sync_error && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <WarningCircle size={14} className="mt-0.5 shrink-0" weight="fill" />
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
