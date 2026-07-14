"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowsClockwise,
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
  const [emailConfigured, setEmailConfigured] = useState(
    site.email_configured
  );
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setProvider(site.hosting_provider);
    setHostingEmail(site.hosting_account_email ?? "");
    setEmailConfigured(site.email_configured);
  }, [
    site.hosting_provider,
    site.hosting_account_email,
    site.email_configured,
    site.id,
  ]);

  const dirty =
    provider !== site.hosting_provider ||
    hostingEmail.trim() !== (site.hosting_account_email ?? "") ||
    emailConfigured !== site.email_configured;

  const siteHref = `https://${site.domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;
  const phoneDigits = site.phone_number?.replace(/\D/g, "") ?? "";
  const phoneTel =
    phoneDigits.length === 10 ? `tel:+1${phoneDigits}` : site.phone_number
      ? `tel:${site.phone_number}`
      : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOps({
        siteId: site.id as Id<"sites">,
        hostingProvider: provider,
        hostingAccountEmail: hostingEmail.trim() || null,
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
        toast.success(
          result.phone_number
            ? `${site.name} is online · ${result.phone_number}`
            : `${site.name} is online`
        );
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Phone size={12} />
              Phone
            </p>
            {site.phone_number && phoneTel ? (
              <a
                href={phoneTel}
                className="mt-0.5 block text-sm text-primary hover:underline"
              >
                {site.phone_number}
              </a>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Not found yet — run Check now
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Booking inbox
            </p>
            {site.contact_email ? (
              <a
                href={`mailto:${site.contact_email}`}
                className="mt-0.5 block truncate text-sm text-primary hover:underline"
              >
                {site.contact_email}
              </a>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Not set</p>
            )}
          </div>
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

        <Button
          type="button"
          size="sm"
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
