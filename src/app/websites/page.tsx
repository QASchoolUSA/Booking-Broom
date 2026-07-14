"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { SiteHealthSyncBanner } from "@/components/websites/SiteHealthSyncBanner";
import { SitesOverview } from "@/components/websites/SitesOverview";
import { SiteOpsCard } from "@/components/websites/SiteOpsCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { SiteOpsRow } from "@/lib/types";

export default function WebsitesPage() {
  const { sites, allBookings, connectionState } = useBookings();
  const { isAuthenticated } = useConvexAuth();

  const syncState = useQuery(
    api.siteHealth.getSyncState,
    isAuthenticated ? {} : "skip"
  );
  const rowsRaw = useQuery(
    api.siteHealth.listStatus,
    isAuthenticated ? {} : "skip"
  );
  const rows = (rowsRaw ?? []) as SiteOpsRow[];
  const loading = isAuthenticated && rowsRaw === undefined;
  const hasStatus = rows.some((r) => r.health != null);

  const counts: Record<string, number> = {};
  allBookings.forEach((b) => {
    const slug = b.site?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  });

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="Sites"
      sidebar={
        <SiteSidebar
          sites={sites}
          counts={counts}
          totalCount={allBookings.length}
        />
      }
    >
      <div className="space-y-6">
        <div className="hidden md:block">
          <h2 className="text-2xl font-bold tracking-tight">Sites</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hosting, contact details, email setup, and uptime for every cleaning
            website
          </p>
        </div>

        <SiteHealthSyncBanner syncState={syncState} hasStatus={hasStatus} />

        {!loading && rows.length > 0 && <SitesOverview rows={rows} />}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sites configured yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <SiteOpsCard key={row.site.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
