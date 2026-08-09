"use client";

import { useCallback, useEffect, useState } from "react";
import { PRICING_ENGINE_LABELS } from "convex/lib/pricingConfigs";
import type { SitePricingRow } from "@/lib/types";
import { SitePricingEditor } from "@/components/pricing/SitePricingEditor";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PricingEditWorkspaceProps {
  rows: SitePricingRow[];
  /** Controlled selected site id; falls back to first row. */
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
}

export function PricingEditWorkspace({
  rows,
  selectedSiteId,
  onSelectSite,
}: PricingEditWorkspaceProps) {
  const [dirtyBySite, setDirtyBySite] = useState<Record<string, number>>({});

  const selected =
    rows.find((row) => row.site.id === selectedSiteId) ?? rows[0] ?? null;

  useEffect(() => {
    if (!selectedSiteId && rows[0]) {
      onSelectSite(rows[0].site.id);
    }
  }, [selectedSiteId, rows, onSelectSite]);

  const handleDirtyChange = useCallback(
    (siteId: string, changed: number) => {
      setDirtyBySite((prev) => {
        if ((prev[siteId] ?? 0) === changed) return prev;
        if (changed === 0) {
          const next = { ...prev };
          delete next[siteId];
          return next;
        }
        return { ...prev, [siteId]: changed };
      });
    },
    []
  );

  const requestSelect = (siteId: string) => {
    if (siteId === selected?.site.id) return;
    const dirty = selected ? (dirtyBySite[selected.site.id] ?? 0) : 0;
    if (dirty > 0) {
      const ok = window.confirm(
        `You have ${dirty} unsaved change${dirty === 1 ? "" : "s"} on ${selected?.site.name}. Discard them?`
      );
      if (!ok) return;
      setDirtyBySite((prev) => {
        if (!selected) return prev;
        const next = { ...prev };
        delete next[selected.site.id];
        return next;
      });
    }
    onSelectSite(siteId);
  };

  const selectedSiteKey = selected?.site.id;

  const onEditorDirtyChange = useCallback(
    (changed: number) => {
      if (!selectedSiteKey) return;
      handleDirtyChange(selectedSiteKey, changed);
    },
    [handleDirtyChange, selectedSiteKey]
  );

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No sites configured yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Mobile site picker */}
      <div className="lg:hidden">
        <label htmlFor="pricing-site-select" className="sr-only">
          Site
        </label>
        <select
          id="pricing-site-select"
          className="flex h-10 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={selected?.site.id ?? ""}
          onChange={(e) => requestSelect(e.target.value)}
        >
          {rows.map((row) => {
            const dirty = dirtyBySite[row.site.id] ?? 0;
            return (
              <option key={row.site.id} value={row.site.id}>
                {row.site.name}
                {dirty > 0 ? ` (${dirty} unsaved)` : ""}
                {!row.pricing ? " — not configured" : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* Desktop site list */}
      <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          Sites
        </p>
        <nav className="space-y-0.5 rounded-xl border bg-card p-1">
          {rows.map((row) => {
            const isActive = row.site.id === selected?.site.id;
            const dirty = dirtyBySite[row.site.id] ?? 0;
            const engine = row.pricing?.engine;
            return (
              <button
                key={row.site.id}
                type="button"
                onClick={() => requestSelect(row.site.id)}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/60"
                )}
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.site.accent_color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {row.site.name}
                    </span>
                    {dirty > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-5 shrink-0 px-1.5 text-[10px]"
                      >
                        {dirty}
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {engine
                      ? `${PRICING_ENGINE_LABELS[engine]} · v${row.pricing!.version}`
                      : "Not configured"}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {selected && (
          <SitePricingEditor
            key={`${selected.site.id}:${selected.pricing?.version ?? "none"}`}
            row={selected}
            onDirtyChange={onEditorDirtyChange}
          />
        )}
      </div>
    </div>
  );
}
