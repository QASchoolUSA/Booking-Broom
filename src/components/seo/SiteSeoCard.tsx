"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import {
  CheckCircle,
  MagnifyingGlass,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { SeoSource, SiteSeoRow } from "@/lib/types";
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
  source: SeoSource;
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

export function SiteSeoCard({ row, source }: SiteSeoCardProps) {
  const { site, metrics, delta, property_status, crawl_issues, page_scan } =
    row;
  const updateGscProperty = useMutation(api.gsc.updateGscProperty);
  const updateBingProperty = useMutation(api.bing.updateBingProperty);
  const scanSite = useAction(api.seoScanActions.scanSite);
  const [editing, setEditing] = useState(false);
  const [propertyUrl, setPropertyUrl] = useState(
    source === "bing"
      ? (site.bing_property_url ?? "")
      : (site.gsc_property_url ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showCrawl, setShowCrawl] = useState(false);
  const [showScan, setShowScan] = useState(false);

  useEffect(() => {
    setPropertyUrl(
      source === "bing"
        ? (site.bing_property_url ?? "")
        : (site.gsc_property_url ?? "")
    );
    setEditing(false);
  }, [source, site.gsc_property_url, site.bing_property_url]);

  const handleSaveProperty = async () => {
    setSaving(true);
    try {
      if (source === "bing") {
        await updateBingProperty({
          siteId: site.id as Id<"sites">,
          bingPropertyUrl: propertyUrl.trim() || null,
        });
        toast.success("Bing property saved — run Sync now to refresh");
      } else {
        await updateGscProperty({
          siteId: site.id as Id<"sites">,
          gscPropertyUrl: propertyUrl.trim() || null,
        });
        toast.success("GSC property saved — run Sync now to refresh");
      }
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanSite({ siteId: site.id as Id<"sites"> });
      toast.success(`Page scan complete · score ${result.score}`);
      setShowScan(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Page scan failed");
    } finally {
      setScanning(false);
    }
  };

  const showPosition = source === "google";
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
        ...(showPosition
          ? [
              {
                label: "Avg position",
                value: formatPosition(metrics.position),
                deltaText: delta
                  ? formatSignedNumber(delta.position, 1)
                  : null,
                direction: "lower-better" as MetricDirection,
                deltaValue: delta?.position ?? 0,
              },
            ]
          : []),
      ]
    : null;

  const notInConsole = property_status === "not_in_console";
  const consoleLabel =
    source === "bing"
      ? "Not in Bing Webmaster"
      : "Not in Google Search Console";
  const propertyLabel = source === "bing" ? "Bing site URL" : "GSC property URL";
  const propertyPlaceholder =
    source === "bing"
      ? "https://www.example.com/"
      : "sc-domain:example.com or https://www.example.com/";
  const currentOverride =
    source === "bing" ? site.bing_property_url : site.gsc_property_url;
  const resolvedProperty =
    metrics?.gsc_property_url ?? row.property_url ?? null;

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
          {resolvedProperty && !notInConsole && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
              {resolvedProperty}
            </p>
          )}
          {notInConsole && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <WarningCircle size={12} weight="fill" />
              {consoleLabel}
            </p>
          )}
        </div>
      </div>

      {notInConsole ? (
        <div className="mt-4 rounded-lg border border-dashed border-amber-300/60 bg-amber-50/50 px-3 py-4 text-center text-sm text-muted-foreground dark:border-amber-800 dark:bg-amber-950/30">
          <p>Add this site in {source === "bing" ? "Bing Webmaster" : "Search Console"}, or set a property override below, then sync.</p>
        </div>
      ) : metricCells ? (
        <div
          className={cn(
            "mt-4 grid gap-3",
            showPosition ? "grid-cols-2" : "grid-cols-3"
          )}
        >
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
        <div className="mt-4 rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          <p>
            No {source === "bing" ? "Bing" : "Search Console"} data yet.
          </p>
          <p className="mt-1 text-xs">Sync to pull metrics for this site.</p>
        </div>
      )}

      {source === "bing" && crawl_issues && !notInConsole && (
        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowCrawl((v) => !v)}
            className="flex w-full items-center justify-between text-left text-xs font-medium"
          >
            <span>
              Crawl issues:{" "}
              <span
                className={cn(
                  "tabular-nums",
                  crawl_issues.issue_count > 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-emerald-700 dark:text-emerald-400"
                )}
              >
                {crawl_issues.issue_count}
              </span>
            </span>
            <span className="text-muted-foreground">
              {showCrawl ? "Hide" : "Show"}
            </span>
          </button>
          {showCrawl && crawl_issues.issues.length > 0 && (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
              {crawl_issues.issues.map((issue) => (
                <li key={issue.url} className="truncate">
                  <span className="font-medium text-foreground">
                    {issue.httpCode}
                  </span>{" "}
                  {issue.url}
                </li>
              ))}
            </ul>
          )}
          {showCrawl && crawl_issues.issues.length === 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              No crawl issues reported.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowScan((v) => !v)}
            className="min-w-0 flex-1 text-left text-xs font-medium"
          >
            {page_scan ? (
              <span className="inline-flex items-center gap-1.5">
                {page_scan.score >= 75 ? (
                  <CheckCircle
                    size={14}
                    className="text-emerald-600"
                    weight="fill"
                  />
                ) : (
                  <XCircle
                    size={14}
                    className="text-amber-600"
                    weight="fill"
                  />
                )}
                Page scan · {page_scan.passed}/{page_scan.total} ·{" "}
                {page_scan.score}
              </span>
            ) : (
              <span className="text-muted-foreground">No page scan yet</span>
            )}
          </button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={handleScan}
            disabled={scanning}
          >
            <MagnifyingGlass size={12} />
            {scanning ? "Scanning…" : "Scan"}
          </Button>
        </div>
        {showScan && page_scan && (
          <ul className="mt-2 space-y-1 text-[11px]">
            {page_scan.checks.map((check) => (
              <li
                key={check.id}
                className="flex items-start gap-1.5 text-muted-foreground"
              >
                {check.pass ? (
                  <CheckCircle
                    size={12}
                    className="mt-0.5 shrink-0 text-emerald-600"
                    weight="fill"
                  />
                ) : (
                  <XCircle
                    size={12}
                    className="mt-0.5 shrink-0 text-amber-600"
                    weight="fill"
                  />
                )}
                <span>
                  <span className="font-medium text-foreground">
                    {check.label}
                  </span>
                  {check.detail ? ` · ${check.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 border-t pt-3">
        {editing ? (
          <div className="space-y-2">
            <Label htmlFor={`prop-${source}-${site.slug}`} className="text-xs">
              {propertyLabel}
            </Label>
            <Input
              id={`prop-${source}-${site.slug}`}
              value={propertyUrl}
              onChange={(e) => setPropertyUrl(e.target.value)}
              placeholder={propertyPlaceholder}
              className="h-9 text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveProperty} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setPropertyUrl(currentOverride ?? "");
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
            {currentOverride
              ? `Edit ${source === "bing" ? "Bing" : "GSC"} property`
              : `Set ${source === "bing" ? "Bing" : "GSC"} property override`}
          </button>
        )}
      </div>
    </div>
  );
}
