"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import type { HostingProvider, Site } from "@/lib/types";
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
import { House } from "@phosphor-icons/react";

const UNSET = "__unset__";

interface SiteHostingRowProps {
  site: Site;
}

export function SiteHostingRow({ site }: SiteHostingRowProps) {
  const updateHosting = useMutation(api.sites.updateHosting);
  const [provider, setProvider] = useState<HostingProvider | null>(
    site.hosting_provider
  );
  const [email, setEmail] = useState(site.hosting_account_email ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProvider(site.hosting_provider);
    setEmail(site.hosting_account_email ?? "");
  }, [site.hosting_provider, site.hosting_account_email, site.id]);

  const dirty =
    provider !== site.hosting_provider ||
    email.trim() !== (site.hosting_account_email ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateHosting({
        siteId: site.id as Id<"sites">,
        hostingProvider: provider,
        hostingAccountEmail: email.trim() || null,
      });
      toast.success(`Hosting info saved for ${site.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save hosting info");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="space-y-3 rounded-lg border px-3 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: site.accent_color }}
          />
          <span className="truncate">{site.name}</span>
        </span>
        <span className="flex items-center gap-1 pl-5 text-xs text-muted-foreground sm:pl-0">
          <House size={14} />
          {site.domain}
        </span>
      </div>

      {site.contact_email && (
        <p className="pl-5 text-xs text-muted-foreground sm:pl-0">
          Booking inbox:{" "}
          <a
            href={`mailto:${site.contact_email}`}
            className="text-primary hover:underline"
          >
            {site.contact_email}
          </a>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`host-${site.slug}`} className="text-xs text-muted-foreground">
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
            Hosting account email
          </Label>
          <Input
            id={`host-email-${site.slug}`}
            type="email"
            autoComplete="off"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </li>
  );
}
