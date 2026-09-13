"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { useSites } from "@/lib/hooks/useSites";
import { useShellPage } from "@/components/layout/ShellChromeContext";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { DeploymentSyncBanner } from "@/components/deployments/DeploymentSyncBanner";
import { DeploymentsOverview } from "@/components/deployments/DeploymentsOverview";
import { DeploymentCard } from "@/components/deployments/DeploymentCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { DeploymentRow } from "@/lib/types";

export default function DeploymentsPage() {
  const { sites, connectionState } = useSites();
  const { isAuthenticated } = useConvexAuth();

  const syncState = useQuery(
    api.deployments.getSyncState,
    isAuthenticated ? {} : "skip"
  );
  const rowsRaw = useQuery(
    api.deployments.listStatus,
    isAuthenticated ? {} : "skip"
  );
  const rows = (rowsRaw ?? []) as DeploymentRow[];
  const loading = isAuthenticated && rowsRaw === undefined;
  const hasStatus = rows.some((r) => r.deployment != null);

  useShellPage({
    connectionState,
    pageTitle: "Deploys",
    sidebar: <SiteSidebar sites={sites} counts={{}} totalCount={0} />,
  });

  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <h2 className="text-2xl font-bold tracking-tight">Deployments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest Cloudflare Workers Builds and free-tier usage — one account per
          cleaning site
        </p>
      </div>

      <DeploymentSyncBanner syncState={syncState} hasStatus={hasStatus} />

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </>
      ) : hasStatus || syncState ? (
        <>
          <DeploymentsOverview rows={rows} />
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              By Worker
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <DeploymentCard
                  key={`${row.target.kind}:${row.target.slug}`}
                  row={row}
                />
              ))}
              {rows.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No deployment targets configured.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
