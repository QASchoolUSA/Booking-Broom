"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
  EnvelopeSimple,
  ArrowSquareOut,
  Phone,
  WifiHigh,
  WifiSlash,
  Question,
} from "@phosphor-icons/react";
import type { HostingProvider, SiteOpsRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const UNSET = "__unset__";

interface SiteOpsCardProps {
  row: SiteOpsRow;
}

export function SiteOpsCard({ row }: SiteOpsCardProps) {
  const { site, health } = row;
  const updateOps = useMutation(api.sites.updateOps);
  const checkSite = useAction(api.siteHealthActions.checkSite);

  const [provider, setProvider] = useState<HostingProvider | null>(
    site.hosting_provider
  );
  const [hostingEmail, setHostingEmail] = useState(
    site.hosting_account_email ?? ""
  );
  const [phone, setPhone] = useState(site.phone_number ?? "");
  const [emailConfigured, setEmailConfigured] = useState(
    site.email_configured
  );
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    setProvider(site.hosting_provider);
    setHostingEmail(site.hosting_account_email ?? "");
    setPhone(site.phone_number ?? "");
    setEmailConfigured(site.email_configured);
  }, [
    site.hosting_provider,
    site.hosting_account_email,
    site.phone_number,
    site.email_configured,
    site.id,
  ]);

  const dirty =
    provider !== site.hosting_provider ||
    hostingEmail.trim() !== (site.hosting_account_email ?? "") ||
    phone.trim() !== (site.phone_number ?? "") ||
    emailConfigured !== site.email_configured;

  const siteHref = `https://${site.domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOps({
        siteId: site.id as Id<"sites">,
        hostingProvider: provider,
        hostingAccountEmail: hostingEmail.trim() || null,
        phoneNumber: phone.trim() || null,
        emailConfigured,
      });
      toast.success(`Saved ops info for ${site.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await checkSite({ siteId: site.id as Id<"sites"> });
      if (result.status === "online") {
        toast.success(`${site.name} is online`);
      } else {
        toast.warning(`${site.name} looks offline`, {
          description: result.error ?? undefined,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Health check failed");
    } finally {
      setChecking(false);
    }
  };

  const handleTestEmail = async () => {
    setSendingTest(true);
    try {
      const res = await fetch("/api/sites/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_slug: site.slug }),
      });
      const data = (await res.json()) as { ok?: boolean; to?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send test email");
      }
      toast.success(`Test email sent to ${data.to}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const statusLabel =
    health?.status === "online"
      ? "Online"
      : health?.status === "offline"
        ? "Offline"
        : "Unchecked";
  const StatusIcon =
    health?.status === "online"
      ? WifiHigh
      : health?.status === "offline"
        ? WifiSlash
        : Question;
  const statusTone =
    health?.status === "online"
      ? "text-emerald-700 dark:text-emerald-400"
      : health?.status === "offline"
        ? "text-red-700 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex min-w-0 items-center gap-2.5 text-base">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: site.accent_color }}
              />
              <a
                href={siteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline"
              >
                {site.name}
              </a>
              <ArrowSquareOut
                size={14}
                className="shrink-0 text-muted-foreground"
              />
            </CardTitle>
            <p className="pl-5 text-xs text-muted-foreground">{site.domain}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                statusTone
              )}
            >
              <StatusIcon size={14} weight="duotone" />
              {statusLabel}
            </span>
            {health?.checked_at && (
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(health.checked_at), {
                  addSuffix: true,
                })}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              disabled={checking}
              onClick={handleCheck}
            >
              <ArrowsClockwise
                size={12}
                className={checking ? "animate-spin" : undefined}
              />
              Recheck
            </Button>
          </div>
        </div>
        {health?.error && health.status === "offline" && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            {health.error}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor={`host-${site.slug}`}
              className="text-xs text-muted-foreground"
            >
              Hosting
            </Label>
            <Select
              value={provider ?? UNSET}
              onValueChange={(v) => {
                if (!v || v === UNSET) setProvider(null);
                else setProvider(v as HostingProvider);
              }}
            >
              <SelectTrigger id={`host-${site.slug}`} className="h-9 w-full">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Not set</SelectItem>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="cloudflare">Cloudflare</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor={`host-email-${site.slug}`}
              className="text-xs text-muted-foreground"
            >
              Cloudflare / Vercel email
            </Label>
            <Input
              id={`host-email-${site.slug}`}
              type="email"
              autoComplete="off"
              placeholder="you@example.com"
              value={hostingEmail}
              onChange={(e) => setHostingEmail(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor={`phone-${site.slug}`}
            className="text-xs text-muted-foreground"
          >
            Phone number
          </Label>
          <div className="relative">
            <Phone
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={`phone-${site.slug}`}
              type="tel"
              autoComplete="off"
              placeholder="(407) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Booking inbox
          </p>
          {site.contact_email ? (
            <a
              href={`mailto:${site.contact_email}`}
              className="mt-0.5 block text-sm text-primary hover:underline"
            >
              {site.contact_email}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">Not set</p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            checked={emailConfigured}
            onChange={(e) => setEmailConfigured(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">Email is set up</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Mark when SMTP / inbox for this site is configured and verified
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={sendingTest || !site.contact_email}
            onClick={handleTestEmail}
          >
            <EnvelopeSimple size={14} />
            {sendingTest ? "Sending…" : "Send test email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
