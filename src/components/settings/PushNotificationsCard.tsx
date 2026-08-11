"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { Bell, BellSlash, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  detectPushSupport,
  getExistingPushSubscription,
  isStandaloneDisplay,
  subscribeToPush,
  subscriptionKeys,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/push-client";

type Status =
  | "loading"
  | "on"
  | "off"
  | "blocked"
  | "unsupported"
  | "ios-needs-install"
  | "missing-vapid";

export function PushNotificationsCard() {
  const { isAuthenticated } = useConvexAuth();
  const vapidPublicKey = useQuery(
    api.push.getVapidPublicKey,
    isAuthenticated ? {} : "skip"
  );
  const saveSubscription = useMutation(api.push.saveSubscription);
  const removeSubscription = useMutation(api.push.removeSubscription);

  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = detectPushSupport();
    setSupport(s);
    if (s === "ios-needs-install" && !isStandaloneDisplay()) {
      setStatus("ios-needs-install");
      return;
    }
    if (s !== "supported") {
      setStatus(s === "ios-needs-install" ? "ios-needs-install" : "unsupported");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const sub = await getExistingPushSubscription();
        if (cancelled) return;
        setStatus(sub ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (vapidPublicKey === null && status === "off") {
      // Config missing — still allow UI to say so when enabling
    }
  }, [vapidPublicKey, status]);

  const enable = async () => {
    if (!vapidPublicKey) {
      setStatus("missing-vapid");
      toast.error("Push is not configured yet (missing VAPID keys)");
      return;
    }
    setBusy(true);
    try {
      const sub = await subscribeToPush(vapidPublicKey);
      const keys = subscriptionKeys(sub);
      await saveSubscription({
        ...keys,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : undefined,
      });
      setStatus("on");
      toast.success("Push notifications enabled on this device");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to enable";
      if (message.toLowerCase().includes("permission")) {
        setStatus("blocked");
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await getExistingPushSubscription();
      if (sub) {
        await removeSubscription({ endpoint: sub.endpoint });
        await unsubscribeFromPush();
      }
      setStatus("off");
      toast.success("Push notifications disabled on this device");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  };

  const description =
    status === "on"
      ? "On on this device — you’ll get an alert for each new booking"
      : status === "blocked"
        ? "Blocked in browser settings — allow notifications for this site"
        : status === "ios-needs-install"
          ? "On iPhone/iPad: Safari → Share → Add to Home Screen, then open the app and enable here"
          : status === "missing-vapid" || vapidPublicKey === null
            ? "Server VAPID keys are not set yet"
            : status === "unsupported"
              ? "This browser does not support web push"
              : "Get an OS notification when a new booking arrives — even if Booking Broom is closed";

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {status === "on" ? (
              <Bell size={20} weight="duotone" />
            ) : (
              <BellSlash size={20} weight="duotone" />
            )}
          </div>
          <div>
            <CardTitle>Push notifications</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(status === "ios-needs-install" ||
          (support === "ios-needs-install" && !isStandaloneDisplay())) && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <WarningCircle size={14} className="mt-0.5 shrink-0" weight="fill" />
            <p>
              iOS only delivers web push from the Home Screen app (not Safari tabs).
              Install Booking Broom first, then come back here.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status === "on" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void disable()}
              className="gap-2"
            >
              {busy && <Spinner className="size-4" label="Disabling" />}
              Disable on this device
            </Button>
          ) : (
            <Button
              type="button"
              disabled={
                busy ||
                status === "loading" ||
                status === "unsupported" ||
                status === "blocked" ||
                status === "ios-needs-install" ||
                vapidPublicKey === undefined
              }
              onClick={() => void enable()}
              className="gap-2"
            >
              {busy && <Spinner className="size-4" label="Enabling" />}
              Enable on this device
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
