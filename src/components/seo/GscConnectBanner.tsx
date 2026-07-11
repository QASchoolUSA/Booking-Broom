"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  LinkBreak,
  LinkSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import type { GscConnection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GscConnectBannerProps {
  connection: GscConnection | null | undefined;
}

export function GscConnectBanner({ connection }: GscConnectBannerProps) {
  const getConnectUrl = useAction(api.gscActions.getConnectUrl);
  const syncNow = useAction(api.gscActions.syncNow);
  const disconnect = useMutation(api.gsc.disconnect);
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(
    null
  );

  const handleConnect = async () => {
    setBusy("connect");
    try {
      const { url } = await getConnectUrl({
        returnOrigin: window.location.origin,
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Google connect");
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    try {
      await syncNow({});
      toast.success("Search Console metrics synced");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Search Console and clear synced metrics?")) {
      return;
    }
    setBusy("disconnect");
    try {
      await disconnect({});
      toast.success("Disconnected Google Search Console");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  };

  if (connection === undefined) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  if (!connection) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LinkSimple size={20} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle>Connect Google Search Console</CardTitle>
              <CardDescription className="mt-1">
                Pull clicks, impressions, CTR, and average position for each
                cleaning site. Requires a Google account that owns the properties
                in Search Console.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={busy === "connect"}>
            {busy === "connect" ? "Redirecting…" : "Connect Google"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const syncedLabel = connection.last_sync_at
    ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })
    : "Never synced";

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            Connected as {connection.google_email}
          </p>
          <p className="text-xs text-muted-foreground">
            Last sync: {syncedLabel}
          </p>
          {connection.last_sync_error && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <WarningCircle size={14} className="mt-0.5 shrink-0" weight="fill" />
              <span>{connection.last_sync_error}</span>
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
            onClick={handleDisconnect}
            disabled={busy !== null}
            className="gap-1.5 text-muted-foreground"
          >
            <LinkBreak size={16} />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
