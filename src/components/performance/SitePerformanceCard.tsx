"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowsClockwise, ArrowSquareOut } from "@phosphor-icons/react";
import type { SitePerformanceRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SitePerformanceCardProps {
  row: SitePerformanceRow;
}

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground border-border";
  if (score >= 90) return "text-emerald-600 border-emerald-500/40";
  if (score >= 50) return "text-amber-600 border-amber-500/40";
  return "text-red-600 border-red-500/40";
}

function scoreRing(score: number | null): string {
  if (score == null) return "stroke-muted";
  if (score >= 90) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-red-500";
}

function ScoreCircle({
  score,
  label,
}: {
  score: number | null;
  label: string;
}) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44" aria-hidden>
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            strokeWidth="3.5"
            className="stroke-muted/60"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("transition-all duration-500", scoreRing(score))}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums",
            scoreColor(score).split(" ")[0]
          )}
        >
          {score != null ? score : "—"}
        </span>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatCls(cls: number | null): string {
  if (cls == null) return "—";
  return cls.toFixed(3);
}

export function SitePerformanceCard({ row }: SitePerformanceCardProps) {
  const { site, metrics } = row;
  const updateUrl = useMutation(api.pagespeed.updatePerformanceUrl);
  const syncSite = useAction(api.pagespeedActions.syncSite);
  const [editing, setEditing] = useState(false);
  const [performanceUrl, setPerformanceUrl] = useState(
    site.performance_url ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setPerformanceUrl(site.performance_url ?? "");
  }, [site.performance_url]);

  const handleSaveUrl = async () => {
    setSaving(true);
    try {
      await updateUrl({
        siteId: site.id as Id<"sites">,
        performanceUrl: performanceUrl.trim() || null,
      });
      toast.success("URL saved — refresh this site to re-run PageSpeed");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await syncSite({
        siteId: site.id as Id<"sites">,
        strategy: "both",
      });
      toast.success(`PageSpeed refreshed for ${site.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const psiLink = metrics?.url
    ? `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(metrics.url)}`
    : `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`https://${site.domain}`)}`;

  const cwv = metrics
    ? [
        { label: "LCP", value: formatMs(metrics.lcp_ms) },
        { label: "CLS", value: formatCls(metrics.cls) },
        { label: "INP/TBT", value: formatMs(metrics.inp_ms) },
        { label: "FCP", value: formatMs(metrics.fcp_ms) },
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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold tracking-tight text-foreground">
                {site.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {metrics?.url ?? site.domain}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh this site"
              >
                <ArrowsClockwise
                  size={16}
                  className={refreshing ? "animate-spin" : undefined}
                />
              </Button>
              <a
                href={psiLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in PageSpeed Insights"
                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowSquareOut size={16} />
              </a>
            </div>
          </div>
          {metrics?.overall_category && (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Field data: {metrics.overall_category}
            </p>
          )}
        </div>
      </div>

      {metrics?.error && !metrics.performance_score ? (
        <div className="mt-4 rounded-lg border border-dashed border-amber-500/40 bg-amber-50/50 px-3 py-4 text-center text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p>{metrics.error}</p>
        </div>
      ) : metrics ? (
        <>
          <div className="mt-4 flex justify-between gap-2 px-1">
            <ScoreCircle score={metrics.performance_score} label="Perf" />
            <ScoreCircle score={metrics.accessibility_score} label="A11y" />
            <ScoreCircle score={metrics.best_practices_score} label="BP" />
            <ScoreCircle score={metrics.seo_score} label="SEO" />
          </div>

          {cwv && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {cwv.map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-lg bg-muted/40 px-3 py-2"
                >
                  <p className="text-sm font-bold tabular-nums leading-none tracking-tight">
                    {cell.value}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {cell.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Synced{" "}
            {formatDistanceToNow(new Date(metrics.synced_at), {
              addSuffix: true,
            })}
          </p>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          <p>No PageSpeed data yet.</p>
          <p className="mt-1 text-xs">Run a sync to audit this site.</p>
        </div>
      )}

      <div className="mt-3 border-t pt-3">
        {editing ? (
          <div className="space-y-2">
            <Label htmlFor={`psi-${site.slug}`} className="text-xs">
              PageSpeed URL override
            </Label>
            <Input
              id={`psi-${site.slug}`}
              value={performanceUrl}
              onChange={(e) => setPerformanceUrl(e.target.value)}
              placeholder={`https://www.${site.domain}/`}
              className="h-9 text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveUrl} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setPerformanceUrl(site.performance_url ?? "");
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
            {site.performance_url
              ? "Edit PageSpeed URL"
              : "Set PageSpeed URL override"}
          </button>
        )}
      </div>
    </div>
  );
}
