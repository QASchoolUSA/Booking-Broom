"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  EnvelopeSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { EmailSyncState } from "@/lib/types";
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

const DISMISS_KEY = "bb.email.dismissedError";

interface EmailSyncBannerProps {
  syncState: EmailSyncState | null | undefined;
  hasMailboxes: boolean;
  mailboxId?: string | null;
  onConnect?: () => void;
  compact?: boolean;
  className?: string;
}

export function EmailSyncBanner({
  syncState,
  hasMailboxes,
  mailboxId,
  onConnect,
  compact = false,
  className,
}: EmailSyncBannerProps) {
  const syncNow = useAction(api.emailActions.syncMailboxNow);
  const [busy, setBusy] = useState(false);
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
      // ignore
    }
    setDismissedError(activeError);
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      const result = await syncNow(
        mailboxId
          ? { mailboxId: mailboxId as Id<"emailMailboxes"> }
          : {}
      );
      if (result.error) {
        toast.warning("Synced with some errors", {
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
      toast.error(e instanceof Error ? e.message : "Failed to sync email");
    } finally {
      setBusy(false);
    }
  };

  if (syncState === undefined && hasMailboxes) {
    return <Skeleton className={cn("h-12 w-full rounded-xl", className)} />;
  }

  if (!hasMailboxes) {
    return (
      <Card className={cn("shadow-sm", className)}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <EnvelopeSimple size={20} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>SpaceMail inbox</CardTitle>
              <CardDescription className="mt-1">
                Connect each site&apos;s SpaceMail mailbox (IMAP/SMTP) to read and
                reply here. Enable IMAP in Spacemail Manager, set{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  EMAIL_CREDENTIALS_KEY
                </code>{" "}
                in Convex env (32-byte secret), then connect a mailbox.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={onConnect} disabled={!onConnect}>
            Connect SpaceMail mailbox
          </Button>
        </CardContent>
      </Card>
    );
  }

  const syncLabel = syncState?.last_sync_at
    ? formatDistanceToNow(new Date(syncState.last_sync_at), { addSuffix: true })
    : "Never";

  const syncButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={busy}
      className="gap-1.5"
    >
      <ArrowsClockwise
        size={16}
        className={busy ? "animate-spin" : undefined}
      />
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        {busy ? "Syncing…" : "Sync now"}
      </span>
    </Button>
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
            Synced {syncLabel}
          </p>
          {syncButton}
        </div>
        {errorRow}
      </div>
    );
  }

  return (
    <Card size="sm" className={cn("shadow-sm", className)}>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-foreground">SpaceMail</p>
          <p className="text-xs text-muted-foreground">
            Last sync: {syncLabel} · Auto every 5 min (one mailbox per tick)
          </p>
          {errorRow}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {onConnect && (
            <Button variant="outline" size="sm" onClick={onConnect}>
              Connect
            </Button>
          )}
          {syncButton}
        </div>
      </CardContent>
    </Card>
  );
}
