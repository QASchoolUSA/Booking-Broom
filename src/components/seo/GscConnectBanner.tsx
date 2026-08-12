"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  Globe,
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
  const submitSitemaps = useAction(api.gscActions.submitSitemaps);
  const disconnect = useMutation(api.gsc.disconnect);
  const [busy, setBusy] = useState<
    "connect" | "sync" | "submit" | "disconnect" | null
  >(null);

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

  const handleSubmitSitemaps = async () => {
    setBusy("submit");
    try {
      const { results } = await submitSitemaps({});
      const submitted = results.filter((r) => r.status === "submitted").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const errors = results.filter((r) => r.status === "error");
      if (errors.length) {
        toast.error(
          `Submitted ${submitted}, skipped ${skipped}, ${errors.length} failed — ${errors[0]?.domain}: ${errors[0]?.detail}`
        );
      } else if (submitted === 0) {
        toast.message(
          "No sitemaps submitted — verify each site in Search Console, then reconnect Google if you recently upgraded permissions."
        );
      } else {
        toast.success(
          `Submitted ${submitted} sitemap${submitted === 1 ? "" : "s"} to Google${skipped ? ` (${skipped} skipped)` : ""}`
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sitemap submit failed";
      toast.error(
        /insufficient|scope|permission/i.test(message)
          ? "Google needs write access — disconnect and Connect Google again, then retry."
          : message
      );
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
    return <Skeleton className="h-16 w-full rounded-xl" />;
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
                cleaning site, and submit sitemaps. Requires a Google account that
                owns the properties in Search Console.
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
    <Card size="sm" className="shadow-sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
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
            variant="outline"
            size="sm"
            onClick={handleSubmitSitemaps}
            disabled={busy !== null}
            className="gap-1.5"
          >
            <Globe size={16} />
            {busy === "submit" ? "Submitting…" : "Submit sitemaps"}
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
