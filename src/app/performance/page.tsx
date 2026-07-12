"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { PagespeedSyncBanner } from "@/components/performance/PagespeedSyncBanner";
import { PerformanceOverview } from "@/components/performance/PerformanceOverview";
import { SitePerformanceCard } from "@/components/performance/SitePerformanceCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { PagespeedStrategy, SitePerformanceRow } from "@/lib/types";

export default function PerformancePage() {
  const { sites, allBookings, connectionState } = useBookings();
  const { isAuthenticated } = useConvexAuth();
  const [strategy, setStrategy] = useState<PagespeedStrategy>("mobile");

  const syncState = useQuery(
    api.pagespeed.getSyncState,
    isAuthenticated ? {} : "skip"
  );
  const rowsRaw = useQuery(
    api.pagespeed.listMetrics,
    isAuthenticated ? { strategy } : "skip"
  );
  const rows = (rowsRaw ?? []) as SitePerformanceRow[];
  const metricsLoading = isAuthenticated && rowsRaw === undefined;
  const hasMetrics = rows.some((r) => r.metrics != null);

  const counts: Record<string, number> = {};
  allBookings.forEach((b) => {
    const slug = b.site?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  });

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="Performance"
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
            <h2 className="text-2xl font-bold tracking-tight">Performance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PageSpeed Insights scores, Agentic Browsing, and Core Web Vitals by site
            </p>
          </div>
          <Tabs
            value={strategy}
            onValueChange={(v) => {
              if (v === "mobile" || v === "desktop") {
                setStrategy(v);
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="mobile">Mobile</TabsTrigger>
              <TabsTrigger value="desktop">Desktop</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <PagespeedSyncBanner
          syncState={syncState}
          hasMetrics={hasMetrics}
        />

        {metricsLoading ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-xl" />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          </>
        ) : hasMetrics || syncState ? (
          <>
            <PerformanceOverview rows={rows} />
            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                By site
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                  <SitePerformanceCard key={row.site.id} row={row} />
                ))}
                {rows.length === 0 && (
                  <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                    No sites configured yet.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
