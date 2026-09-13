"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  computeBasket,
  DEFAULT_SCENARIO,
  scenarioFromInputs,
  scenarioLabel,
  type PricingScenario,
} from "convex/lib/pricingEngines";
import { useSites } from "@/lib/hooks/useSites";
import { useShellPage } from "@/components/layout/ShellChromeContext";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { PricingCompareGrid } from "@/components/pricing/PricingCompareGrid";
import { PricingEditWorkspace } from "@/components/pricing/PricingEditWorkspace";
import { PricingInsightStrip } from "@/components/pricing/PricingInsightStrip";
import { PricingScenarioBar } from "@/components/pricing/PricingScenarioBar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { SitePricingRow } from "@/lib/types";
import {
  addonCatalogFromRows,
  computeScenarioInsight,
} from "@/lib/pricing-scenario";

type PricingTab = "compare" | "edit";

export default function PricingPage() {
  const { sites, connectionState } = useSites();
  const { isAuthenticated } = useConvexAuth();
  const [tab, setTab] = useState<PricingTab>("compare");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<PricingScenario>(() => ({
    ...DEFAULT_SCENARIO,
    addonKeys: [],
  }));

  const rowsRaw = useQuery(api.pricing.list, isAuthenticated ? {} : "skip");
  const rows = (rowsRaw ?? []) as SitePricingRow[];
  const loading = isAuthenticated && rowsRaw === undefined;

  const unconfigured = rows.filter((row) => row.pricing === null).length;

  const compareRows = useMemo(() => {
    return rows.map((row) => {
      if (!row.pricing) return { ...row, basket: null };
      return {
        ...row,
        basket: computeBasket(row.pricing.config, scenario),
      };
    });
  }, [rows, scenario]);

  const addonOptions = useMemo(() => addonCatalogFromRows(rows), [rows]);
  const insight = useMemo(
    () => computeScenarioInsight(compareRows, "standard"),
    [compareRows]
  );

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
  };

  const handleEditSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    setTab("edit");
  };

  const handleScenarioChange = (next: PricingScenario) => {
    setScenario(
      scenarioFromInputs({
        bedrooms: next.bedrooms,
        bathrooms: next.bathrooms,
        squareFeet: next.squareFeet,
        hours: next.hours,
        conditionKey: next.conditionKey,
        propertyTypeKey: next.propertyTypeKey,
        debrisKey: next.debrisKey,
        addonKeys: next.addonKeys,
      })
    );
  };

  const handleReset = () => {
    setScenario({ ...DEFAULT_SCENARIO, addonKeys: [] });
  };

  useShellPage({
    connectionState,
    pageTitle: "Pricing",
    sidebar: <SiteSidebar sites={sites} counts={{}} totalCount={0} />,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="hidden md:block">
          <h2 className="text-2xl font-bold tracking-tight">Pricing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quote any home, compare every market, then edit one site at a time
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
          <p>
            {unconfigured} site{unconfigured === 1 ? "" : "s"} still need
            pricing imported before you can edit or compare them.
          </p>
          <p className="mt-1 text-xs opacity-90">
            Ask a developer to sync shipped prices, then refresh. Developer
            command:{" "}
            <code className="rounded bg-amber-500/20 px-1 py-0.5">
              convex run internal.seed.syncSeedPricing
            </code>
          </p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : tab === "compare" ? (
        <div className="space-y-4">
          <PricingScenarioBar
            scenario={scenario}
            addonOptions={addonOptions}
            onChange={handleScenarioChange}
            onReset={handleReset}
          />
          <PricingInsightStrip insight={insight} />
          <PricingCompareGrid
            rows={compareRows}
            scenarioLabelText={scenarioLabel(scenario)}
            onEditSite={handleEditSite}
          />
        </div>
      ) : (
        <PricingEditWorkspace
          rows={rows}
          selectedSiteId={selectedSiteId}
          onSelectSite={handleSelectSite}
        />
      )}
    </div>
  );
}
