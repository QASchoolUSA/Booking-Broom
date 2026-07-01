"use client";

import { useState } from "react";
import { Flask } from "@phosphor-icons/react";
import type { Site } from "@/lib/types";
import { getDevApiKey } from "@/lib/api-keys";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SAMPLE_NAMES = [
  "Jane Smith",
  "Robert Johnson",
  "Maria Garcia",
  "David Williams",
  "Sarah Brown",
];

const SAMPLE_SERVICES = [
  "Standard Clean",
  "Deep Clean",
  "Move-Out Clean",
  "Recurring Weekly",
];

interface DevSeedToolProps {
  sites: Site[];
  onCreated: () => void;
}

export function DevSeedTool({ sites, onCreated }: DevSeedToolProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [siteSlug, setSiteSlug] = useState(sites[0]?.slug ?? "");

  const createTestBooking = async () => {
    if (!siteSlug) return;

    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_slug: siteSlug,
          api_key: getDevApiKey(siteSlug),
          customer_name: SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)],
          email: "customer@example.com",
          phone: "+1 (407) 555-0100",
          address: "123 Main Street, FL 32771",
          service_type: SAMPLE_SERVICES[Math.floor(Math.random() * SAMPLE_SERVICES.length)],
          preferred_date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
          preferred_time: "morning",
          notes: "2 bed, 2 bath. Please call before arriving.",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create booking");
      }

      toast.success("Test booking created");
      onCreated();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  if (process.env.NODE_ENV === "production") return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        className="min-h-10 gap-2"
        onClick={() => setOpen(true)}
      >
        <Flask size={16} weight="duotone" />
        Test booking
      </Button>
      <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle>Create test booking</SheetTitle>
          <SheetDescription>
            Simulates a booking from one of your cleaning sites. Development only.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label>Site</Label>
            <Select value={siteSlug} onValueChange={(v) => v && setSiteSlug(v)}>
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.slug} value={site.slug}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>API key (dev)</Label>
            <Input readOnly value={siteSlug ? getDevApiKey(siteSlug) : ""} className="font-mono text-xs" />
          </div>
          <Button
            onClick={createTestBooking}
            disabled={loading || !siteSlug}
            className="min-h-11 w-full"
          >
            {loading ? "Creating…" : "Create random test booking"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
