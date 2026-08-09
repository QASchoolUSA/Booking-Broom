"use client";

import { useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { PricingCompareGrid } from "@/components/pricing/PricingCompareGrid";
import { SitePricingCard } from "@/components/pricing/SitePricingCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { SitePricingRow } from "@/lib/types";

type PricingTab = "compare" | "edit";

export default function PricingPage() {
  const { sites, allBookings, connectionState } = useBookings();
  const { isAuthenticated } = useConvexAuth();
  const [tab, setTab] = useState<PricingTab>("compare");

  const rowsRaw = useQuery(api.pricing.list, isAuthenticated ? {} : "skip");
  const rows = (rowsRaw ?? []) as SitePricingRow[];
  const loading = isAuthenticated && rowsRaw === undefined;

  const counts: Record<string, number> = {};
  allBookings.forEach((b) => {
    const slug = b.site?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  });

  const unconfigured = rows.filter((row) => row.pricing === null).length;

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="Pricing"
      sidebar={
        <SiteSidebar
          sites={sites}
          counts={counts}
          totalCount={allBookings.length}
        />
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="hidden md:block">
            <h2 className="text-2xl font-bold tracking-tight">Pricing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              What every site charges, and the one place to change it
            </p>
          </div>
          <Tabs
            value={tab}
            onValueChange={(v) => {
              if (v === "compare" || v === "edit") setTab(v);
            }}
          >
            <TabsList>
              <TabsTrigger value="compare">Compare</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {unconfigured > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            {unconfigured} site{unconfigured === 1 ? "" : "s"} have no pricing
            configured yet. Run{" "}
            <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">
              convex run internal.seed.syncSeedPricing
            </code>{" "}
            to import the numbers they currently ship with.
          </div>
        )}

        {loading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : tab === "compare" ? (
          <PricingCompareGrid rows={rows} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((row) => (
              // Keyed on the saved version so a save (or another manager's edit)
              // remounts the card onto the new numbers instead of leaving a
              // stale draft behind.
              <SitePricingCard
                key={`${row.site.id}:${row.pricing?.version ?? "none"}`}
                row={row}
              />
            ))}
            {rows.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                No sites configured yet.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
