"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import type { SiteSeoRow } from "@/lib/types";
import {
  deltaClassName,
  formatSignedCtr,
  formatSignedNumber,
  type MetricDirection,
} from "@/lib/seoDeltas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SiteSeoCardProps {
  row: SiteSeoRow;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}

function formatPosition(pos: number): string {
  if (pos <= 0) return "—";
  return pos.toFixed(1);
}

export function SiteSeoCard({ row }: SiteSeoCardProps) {
  const { site, metrics, delta } = row;
  const updateProperty = useMutation(api.gsc.updateGscProperty);
  const [editing, setEditing] = useState(false);
  const [propertyUrl, setPropertyUrl] = useState(site.gsc_property_url ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPropertyUrl(site.gsc_property_url ?? "");
  }, [site.gsc_property_url]);

  const handleSaveProperty = async () => {
    setSaving(true);
    try {
      await updateProperty({
        siteId: site.id as Id<"sites">,
        gscPropertyUrl: propertyUrl.trim() || null,
      });
      toast.success("GSC property saved — run Sync now to refresh");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const metricCells = metrics
    ? [
        {
          label: "Clicks",
          value: formatNumber(metrics.clicks),
          deltaText: delta ? formatSignedNumber(delta.clicks) : null,
          direction: "higher-better" as MetricDirection,
          deltaValue: delta?.clicks ?? 0,
        },
        {
          label: "Impressions",
          value: formatNumber(metrics.impressions),
          deltaText: delta ? formatSignedNumber(delta.impressions) : null,
          direction: "higher-better" as MetricDirection,
          deltaValue: delta?.impressions ?? 0,
        },
        {
          label: "CTR",
          value: formatCtr(metrics.ctr),
          deltaText: delta ? formatSignedCtr(delta.ctr) : null,
          direction: "higher-better" as MetricDirection,
          deltaValue: delta?.ctr ?? 0,
        },
        {
          label: "Avg position",
          value: formatPosition(metrics.position),
          deltaText: delta ? formatSignedNumber(delta.position, 1) : null,
          direction: "lower-better" as MetricDirection,
          deltaValue: delta?.position ?? 0,
        },
      ]
    : null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: site.accent_color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-tight text-foreground">
            {site.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{site.domain}</p>
          {metrics?.gsc_property_url && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
              {metrics.gsc_property_url}
            </p>
          )}
        </div>
      </div>

      {metricCells ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {metricCells.map((cell) => (
            <div key={cell.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-lg font-bold tabular-nums leading-none tracking-tight">
                {cell.value}
              </p>
              {cell.deltaText && (
                <p
                  className={cn(
                    "mt-1",
                    deltaClassName(cell.deltaValue, cell.direction)
                  )}
                >
                  {cell.deltaText}
                </p>
              )}
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                {cell.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "mt-4 rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground"
          )}
        >
          <p>No Search Console data yet.</p>
          <p className="mt-1 text-xs">
            Match this site to a GSC property, then sync.
          </p>
        </div>
      )}

      <div className="mt-3 border-t pt-3">
        {editing ? (
          <div className="space-y-2">
            <Label htmlFor={`gsc-${site.slug}`} className="text-xs">
              GSC property URL
            </Label>
            <Input
              id={`gsc-${site.slug}`}
              value={propertyUrl}
              onChange={(e) => setPropertyUrl(e.target.value)}
              placeholder="sc-domain:example.com or https://www.example.com/"
              className="h-9 text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveProperty}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setPropertyUrl(site.gsc_property_url ?? "");
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {site.gsc_property_url
              ? "Edit GSC property"
              : "Set GSC property override"}
          </button>
        )}
      </div>
    </div>
  );
}
