"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  ChatCircle,
  Phone,
  WarningCircle,
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

interface SmsSyncBannerProps {
  syncState: SmsSyncState | null | undefined;
  hasDids: boolean;
}

export function SmsSyncBanner({ syncState, hasDids }: SmsSyncBannerProps) {
  const syncDids = useAction(api.voipmsActions.syncDidsNow);
  const syncMessages = useAction(api.voipmsActions.syncMessagesNow);
  const [busy, setBusy] = useState<"dids" | "messages" | null>(null);

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
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }

  if (!hasDids && !syncState) {
    return (
      <Card className="shadow-sm">
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

  return (
    <Card size="sm" className="shadow-sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">Voip.ms messages</p>
          <p className="text-xs text-muted-foreground">
            Numbers: {didLabel} · Messages: {msgLabel} · Auto every 15 min
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
            onClick={handleSyncDids}
            disabled={busy !== null}
            className="gap-1.5"
          >
            <Phone
              size={16}
              className={busy === "dids" ? "animate-pulse" : undefined}
            />
            {busy === "dids" ? "Syncing…" : "Sync numbers"}
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
            {busy === "messages" ? "Syncing…" : "Sync messages"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
