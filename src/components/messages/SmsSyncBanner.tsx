"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  ChatCircle,
  Phone,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { SmsSyncState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "bb.sms.dismissedError";

interface SmsSyncBannerProps {
  syncState: SmsSyncState | null | undefined;
  hasDids: boolean;
  /** Compact single-row toolbar for mobile list / desktop header strip. */
  compact?: boolean;
  className?: string;
}

export function SmsSyncBanner({
  syncState,
  hasDids,
  compact = false,
  className,
}: SmsSyncBannerProps) {
  const syncDids = useAction(api.voipmsActions.syncDidsNow);
  const syncMessages = useAction(api.voipmsActions.syncMessagesNow);
  const [busy, setBusy] = useState<"dids" | "messages" | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedError(localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissedError(null);
    }
  }, []);

  const activeError = syncState?.last_sync_error ?? null;
  const showError = Boolean(activeError && activeError !== dismissedError);

  const dismissError = () => {
    if (!activeError) return;
    try {
      localStorage.setItem(DISMISS_KEY, activeError);
    } catch {
      // ignore quota / private mode
    }
    setDismissedError(activeError);
  };

  const handleSyncDids = async () => {
    setBusy("dids");
    try {
      const result = await syncDids({ configureCallbacks: true });
      toast.success(
        `Synced ${result.count} number${result.count === 1 ? "" : "s"} from Voip.ms`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync numbers");
    } finally {
      setBusy(null);
    }
  };

  const handleSyncMessages = async () => {
    setBusy("messages");
    try {
      const result = await syncMessages({ daysBack: 30 });
      if (result.error) {
        toast.warning("Messages synced with some errors", {
          description: result.error,
        });
      } else {
        try {
          localStorage.removeItem(DISMISS_KEY);
        } catch {
          // ignore
        }
        setDismissedError(null);
        toast.success(
          `Synced ${result.upserted} message${result.upserted === 1 ? "" : "s"}`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync messages");
    } finally {
      setBusy(null);
    }
  };

  if (syncState === undefined) {
    return <Skeleton className={cn("h-12 w-full rounded-xl", className)} />;
  }

  if (!hasDids && !syncState) {
    return (
      <Card className={cn("shadow-sm", className)}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ChatCircle size={20} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>Voip.ms SMS / MMS</CardTitle>
              <CardDescription className="mt-1">
                Connect your Voip.ms numbers to read and reply to texts. Set{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  VOIPMS_API_USERNAME
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  VOIPMS_API_PASSWORD
                </code>
                , and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  VOIPMS_WEBHOOK_SECRET
                </code>{" "}
                in Convex env, whitelist your API IP, then sync numbers.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSyncDids} disabled={busy === "dids"}>
            {busy === "dids" ? "Syncing numbers…" : "Sync numbers from Voip.ms"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const didLabel = syncState?.last_did_sync_at
    ? formatDistanceToNow(new Date(syncState.last_did_sync_at), {
        addSuffix: true,
      })
    : "Never";
  const msgLabel = syncState?.last_sync_at
    ? formatDistanceToNow(new Date(syncState.last_sync_at), { addSuffix: true })
    : "Never";

  const syncButtons = (
    <div className="flex shrink-0 flex-wrap gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncDids}
        disabled={busy !== null}
        className="gap-1.5"
      >
        <Phone
          size={16}
          className={busy === "dids" ? "animate-pulse" : undefined}
        />
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
          {busy === "dids" ? "Syncing…" : "Numbers"}
        </span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncMessages}
        disabled={busy !== null}
        className="gap-1.5"
      >
        <ArrowsClockwise
          size={16}
          className={busy === "messages" ? "animate-spin" : undefined}
        />
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
          {busy === "messages" ? "Syncing…" : "Messages"}
        </span>
      </Button>
    </div>
  );

  const errorRow = showError && activeError && (
    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
      <WarningCircle size={14} className="mt-0.5 shrink-0" weight="fill" />
      <p className="min-w-0 flex-1 break-words">{activeError}</p>
      <button
        type="button"
        onClick={dismissError}
        className="shrink-0 rounded-md p-0.5 text-amber-800/70 transition-colors hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-200"
        aria-label="Dismiss error"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
            Synced {msgLabel}
          </p>
          {syncButtons}
        </div>
        {errorRow}
      </div>
    );
  }

  return (
    <Card size="sm" className={cn("shadow-sm", className)}>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-foreground">Voip.ms messages</p>
          <p className="text-xs text-muted-foreground">
            Numbers: {didLabel} · Messages: {msgLabel} · Auto every 15 min
          </p>
          {errorRow}
        </div>
        {syncButtons}
      </CardContent>
    </Card>
  );
}
