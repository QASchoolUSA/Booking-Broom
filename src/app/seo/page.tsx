"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { GscConnectBanner } from "@/components/seo/GscConnectBanner";
import { SeoOverview } from "@/components/seo/SeoOverview";
import { SiteSeoCard } from "@/components/seo/SiteSeoCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeoPeriodDays, SiteSeoRow } from "@/lib/types";

const PERIODS: { value: SeoPeriodDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 28, label: "28 days" },
  { value: 90, label: "90 days" },
];

function SeoPageContent() {
  const { sites, allBookings, connectionState } = useBookings();
  const { isAuthenticated } = useConvexAuth();
  const [period, setPeriod] = useState<SeoPeriodDays>(28);
  const searchParams = useSearchParams();
  const router = useRouter();

  const connection = useQuery(
    api.gsc.getConnection,
    isAuthenticated ? {} : "skip"
  );
  const rowsRaw = useQuery(
    api.gsc.listMetrics,
    isAuthenticated ? { periodDays: period } : "skip"
  );
  const rows = (rowsRaw ?? []) as SiteSeoRow[];
  const metricsLoading = isAuthenticated && rowsRaw === undefined;

  useEffect(() => {
    const gsc = searchParams.get("gsc");
    if (!gsc) return;
    if (gsc === "connected") {
      toast.success("Google Search Console connected");
    } else if (gsc === "error") {
      const message =
        searchParams.get("message") ||
        "Failed to connect Google Search Console";
      toast.error(message);
    }
    router.replace("/seo", { scroll: false });
  }, [searchParams, router]);

  const counts: Record<string, number> = {};
  allBookings.forEach((b) => {
    const slug = b.site?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  });

  const sampleMetrics = rows.find((r) => r.metrics)?.metrics;
  const dateRangeLabel = sampleMetrics
    ? `${sampleMetrics.start_date} → ${sampleMetrics.end_date}`
    : null;

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="SEO"
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
            <h2 className="text-2xl font-bold tracking-tight">SEO</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Google Search Console performance by site
              {dateRangeLabel ? ` · ${dateRangeLabel}` : ""}
            </p>
          </div>
          <Tabs
            value={String(period)}
            onValueChange={(v) => {
              if (v === "7" || v === "28" || v === "90") {
                setPeriod(Number(v) as SeoPeriodDays);
              }
            }}
          >
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={String(p.value)}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <GscConnectBanner connection={connection} />

        {connection && (
          <>
            {metricsLoading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px] rounded-xl" />
                ))}
              </div>
            ) : (
              <SeoOverview rows={rows} />
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                By site
              </h3>
              {metricsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((row) => (
                    <SiteSeoCard key={row.site.id} row={row} />
                  ))}
                  {rows.length === 0 && (
                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      No sites configured yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function SeoPage() {
  return (
    <Suspense
      fallback={
        <div className="dashboard-bg flex min-h-dvh items-center justify-center p-8">
          <Skeleton className="h-10 w-48" />
        </div>
      }
    >
      <SeoPageContent />
    </Suspense>
  );
}
