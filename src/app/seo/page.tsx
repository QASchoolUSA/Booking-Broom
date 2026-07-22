"use client";

import { Suspense, useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { GscConnectBanner } from "@/components/seo/GscConnectBanner";
import { BingSyncBanner } from "@/components/seo/BingSyncBanner";
import { SeoOverview } from "@/components/seo/SeoOverview";
import { SiteSeoCard } from "@/components/seo/SiteSeoCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeoPeriodDays, SeoSource, SiteSeoRow } from "@/lib/types";

const PERIODS: { value: SeoPeriodDays; label: string }[] = [
  { value: 1, label: "Today" },
  { value: 2, label: "Yesterday" },
  { value: 7, label: "7 days" },
  { value: 28, label: "28 days" },
  { value: 90, label: "90 days" },
];

function SeoPageContent() {
  const { sites, allBookings, connectionState } = useBookings();
  const { isAuthenticated } = useConvexAuth();
  const [period, setPeriod] = useState<SeoPeriodDays>(28);
  const [source, setSource] = useState<SeoSource>("google");
  const [scanningAll, setScanningAll] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const scanAll = useAction(api.seoScanActions.scanAll);

  const gscConnection = useQuery(
    api.gsc.getConnection,
    isAuthenticated ? {} : "skip"
  );
  const bingSyncState = useQuery(
    api.bing.getSyncState,
    isAuthenticated && source === "bing" ? {} : "skip"
  );

  const gscRowsRaw = useQuery(
    api.gsc.listMetrics,
    isAuthenticated && source === "google" ? { periodDays: period } : "skip"
  );
  const bingRowsRaw = useQuery(
    api.bing.listMetrics,
    isAuthenticated && source === "bing" ? { periodDays: period } : "skip"
  );

  const rowsRaw = source === "google" ? gscRowsRaw : bingRowsRaw;
  const rows = (rowsRaw ?? []) as SiteSeoRow[];
  const metricsLoading = isAuthenticated && rowsRaw === undefined;

  const showContent =
    source === "google" ? Boolean(gscConnection) : isAuthenticated;

  useEffect(() => {
    const gsc = searchParams.get("gsc");
    if (!gsc) return;
    if (gsc === "connected") {
      toast.success("Google Search Console connected");
      setSource("google");
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

  const handleScanAll = async () => {
    setScanningAll(true);
    try {
      const result = await scanAll({});
      if (result.error) {
        toast.warning(`Scanned ${result.sites} sites with some errors`, {
          description: result.error,
        });
      } else {
        toast.success(
          `Scanned ${result.sites} site${result.sites === 1 ? "" : "s"}`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan all failed");
    } finally {
      setScanningAll(false);
    }
  };

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
              {source === "google"
                ? "Google Search Console"
                : "Bing Webmaster"}{" "}
              performance by site
              {dateRangeLabel ? ` · ${dateRangeLabel}` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Tabs
              value={source}
              onValueChange={(v) => {
                if (v === "google" || v === "bing") setSource(v);
              }}
            >
              <TabsList>
                <TabsTrigger value="google">Google</TabsTrigger>
                <TabsTrigger value="bing">Bing</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs
              value={String(period)}
              onValueChange={(v) => {
                const n = Number(v);
                if (n === 1 || n === 2 || n === 7 || n === 28 || n === 90) {
                  setPeriod(n);
                }
              }}
            >
              <TabsList className="max-w-full overflow-x-auto">
                {PERIODS.map((p) => (
                  <TabsTrigger key={p.value} value={String(p.value)}>
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {source === "google" ? (
          <GscConnectBanner connection={gscConnection} />
        ) : (
          <BingSyncBanner
            syncState={bingSyncState}
            hasMetrics={rows.some((r) => r.metrics)}
          />
        )}

        {isAuthenticated && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleScanAll}
              disabled={scanningAll}
            >
              <MagnifyingGlass size={16} />
              {scanningAll ? "Scanning all…" : "Scan all pages"}
            </Button>
          </div>
        )}

        {showContent && (
          <>
            {metricsLoading ? (
              <div
                className={
                  source === "google"
                    ? "grid grid-cols-2 gap-3 lg:grid-cols-4"
                    : "grid grid-cols-2 gap-3 lg:grid-cols-3"
                }
              >
                {Array.from({ length: source === "google" ? 4 : 3 }).map(
                  (_, i) => (
                    <Skeleton key={i} className="h-[72px] rounded-xl" />
                  )
                )}
              </div>
            ) : (
              <SeoOverview rows={rows} source={source} />
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
                    <SiteSeoCard key={row.site.id} row={row} source={source} />
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
