"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  Globe,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type { SiteHealthSyncState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SiteHealthSyncBannerProps {
  syncState: SiteHealthSyncState | null | undefined;
  hasStatus: boolean;
}

export function SiteHealthSyncBanner({
  syncState,
  hasStatus,
}: SiteHealthSyncBannerProps) {
  const checkNow = useAction(api.siteHealthActions.checkNow);
  const clearStatus = useMutation(api.siteHealth.clearStatus);
  const [busy, setBusy] = useState<"check" | "clear" | null>(null);

  const handleCheck = async () => {
    setBusy("check");
    try {
      const result = await checkNow({});
      if (result.error) {
        toast.warning("Health check finished with issues", {
          description: result.error,
        });
      } else {
        toast.success(
          `Checked ${result.sites} site${result.sites === 1 ? "" : "s"} — all online`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Health check failed");
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all stored site health results?")) return;
    setBusy("clear");
    try {
      await clearStatus({});
      toast.success("Site health status cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear status");
    } finally {
      setBusy(null);
    }
  };

  if (syncState === undefined) {
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }

  if (!syncState && !hasStatus) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe size={20} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>Site uptime</CardTitle>
              <CardDescription className="mt-1">
                Fetch each cleaning site, confirm the page includes the site
                name, and pull the contact phone from the HTML. Checks also run
                automatically every 3 hours.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCheck} disabled={busy === "check"}>
            {busy === "check" ? "Checking…" : "Check all sites now"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const syncedLabel = syncState?.last_sync_at
    ? formatDistanceToNow(new Date(syncState.last_sync_at), { addSuffix: true })
    : "Never checked";

  return (
    <Card size="sm" className="shadow-sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">Site uptime</p>
          <p className="text-xs text-muted-foreground">
            Last check: {syncedLabel}
            {" · "}Every 3 hours
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
            onClick={handleCheck}
            disabled={busy !== null}
            className="gap-1.5"
          >
            <ArrowsClockwise
              size={16}
              className={busy === "check" ? "animate-spin" : undefined}
            />
            {busy === "check" ? "Checking…" : "Check now"}
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
