"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import {
  CaretDown,
  CaretUp,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SeoTopQuery } from "@/lib/types";
import {
  DEFAULT_SEO_KEYWORD_SORT,
  nextSeoSort,
  sortSeoKeywords,
  type SeoSort,
  type SeoSortKey,
} from "@/lib/seoSort";

const KEYWORD_PREVIEW = 10;

interface SiteSeoCardProps {
  row: SiteSeoRow;
  source: SeoSource;
  /** Shared keyword sort across all site cards (controlled from SEO page). */
  keywordSort?: SeoSort;
  onKeywordSortChange?: (next: SeoSort) => void;
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

export function SiteSeoCard({
  row,
  source,
  keywordSort: keywordSortProp,
  onKeywordSortChange,
}: SiteSeoCardProps) {
  const { site, metrics, delta, property_status, crawl_issues, page_scan, top_queries } =
    row;
  const updateBingProperty = useMutation(api.bing.updateBingProperty);
  const scanSite = useAction(api.seoScanActions.scanSite);
  const [editing, setEditing] = useState(false);
  const [propertyUrl, setPropertyUrl] = useState(site.bing_property_url ?? "");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showCrawl, setShowCrawl] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [localKeywordSort, setLocalKeywordSort] = useState<SeoSort>(
    DEFAULT_SEO_KEYWORD_SORT
  );

  const keywordSort = keywordSortProp ?? localKeywordSort;
  const setKeywordSort = (next: SeoSort) => {
    if (onKeywordSortChange) onKeywordSortChange(next);
    else setLocalKeywordSort(next);
  };

  const sortedKeywords = useMemo(
    () => sortSeoKeywords(top_queries ?? [], keywordSort),
    [top_queries, keywordSort]
  );
  const previewKeywords = sortedKeywords.slice(0, KEYWORD_PREVIEW);
  const keywordClickTotal = useMemo(
    () => sortedKeywords.reduce((sum, q) => sum + q.clicks, 0),
    [sortedKeywords]
  );
  const keywordImpressionTotal = useMemo(
    () => sortedKeywords.reduce((sum, q) => sum + q.impressions, 0),
    [sortedKeywords]
  );
  const previewClickTotal = useMemo(
    () => previewKeywords.reduce((sum, q) => sum + q.clicks, 0),
    [previewKeywords]
  );
  const siteClicks = metrics?.clicks ?? 0;
  const siteImpressions = metrics?.impressions ?? 0;
  const uncoveredClicks = Math.max(0, Math.round(siteClicks) - Math.round(keywordClickTotal));
  const uncoveredImpressions = Math.max(
    0,
    Math.round(siteImpressions) - Math.round(keywordImpressionTotal)
  );

  useEffect(() => {
    setPropertyUrl(site.bing_property_url ?? "");
    setEditing(false);
  }, [source, site.bing_property_url]);

  const handleSaveProperty = async () => {
    setSaving(true);
    try {
      await updateBingProperty({
        siteId: site.id as Id<"sites">,
        bingPropertyUrl: propertyUrl.trim() || null,
      });
      toast.success("Bing property saved — run Sync now to refresh");
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
  const bingOverride = site.bing_property_url ?? null;

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
          <p>
            {source === "bing"
              ? "Add this site in Bing Webmaster, or set a property override below, then sync."
              : "Add this site in Search Console (matching this domain), then sync."}
          </p>
        </div>
      ) : metricCells ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {metricCells
              .filter((c) => c.label === "Clicks" || c.label === "Impressions")
              .map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-xl border border-border/60 bg-gradient-to-b from-muted/50 to-muted/20 px-3.5 py-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {cell.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                    {cell.value}
                  </p>
                  {cell.deltaText && (
                    <p
                      className={cn(
                        "mt-1 text-xs font-medium",
                        deltaClassName(cell.deltaValue, cell.direction)
                      )}
                    >
                      {cell.deltaText}
                    </p>
                  )}
                </div>
              ))}
          </div>
          <div
            className={cn(
              "grid gap-3",
              showPosition ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            {metricCells
              .filter((c) => c.label !== "Clicks" && c.label !== "Impressions")
              .map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-lg bg-muted/40 px-3 py-2.5"
                >
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
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          <p>
            No {source === "bing" ? "Bing" : "Search Console"} data yet.
          </p>
          <p className="mt-1 text-xs">Sync to pull metrics for this site.</p>
        </div>
      )}

      {!notInConsole && (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Top keywords
          </p>
          {sortedKeywords.length > 0 ? (
            <>
              <KeywordList
                queries={previewKeywords}
                startIndex={0}
                compact
                sort={keywordSort}
                onSortKey={(key) => setKeywordSort(nextSeoSort(keywordSort, key))}
                showPosition={showPosition}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                {uncoveredClicks > 0 || uncoveredImpressions > 0 ? (
                  <>
                    Keywords cover{" "}
                    <span className="font-medium text-foreground">
                      {formatNumber(keywordClickTotal)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-foreground">
                      {formatNumber(siteClicks)}
                    </span>{" "}
                    clicks
                    {uncoveredImpressions > 0 ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-medium text-foreground">
                          {formatNumber(keywordImpressionTotal)}
                        </span>{" "}
                        of{" "}
                        <span className="font-medium text-foreground">
                          {formatNumber(siteImpressions)}
                        </span>{" "}
                        impressions
                      </>
                    ) : null}
                    . Remaining traffic is from queries outside this list —
                    Sync again after deploy to pull up to 500 keywords, or sort
                    by Clicks to surface clicky queries.
                  </>
                ) : sortedKeywords.length > KEYWORD_PREVIEW &&
                  previewClickTotal < keywordClickTotal ? (
                  <>
                    Preview shows{" "}
                    <span className="font-medium text-foreground">
                      {formatNumber(previewClickTotal)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-foreground">
                      {formatNumber(keywordClickTotal)}
                    </span>{" "}
                    keyword clicks — open all or sort by Clicks.
                  </>
                ) : (
                  <>
                    {sortedKeywords.length} keywords ·{" "}
                    {formatNumber(keywordClickTotal)} clicks ·{" "}
                    {formatNumber(keywordImpressionTotal)} impressions
                  </>
                )}
              </p>
              {sortedKeywords.length > KEYWORD_PREVIEW ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setKeywordsOpen(true)}
                >
                  View all {sortedKeywords.length} keywords
                </Button>
              ) : null}
              <Sheet open={keywordsOpen} onOpenChange={setKeywordsOpen}>
                <SheetContent
                  side="right"
                  className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
                >
                  <SheetHeader className="border-b">
                    <SheetTitle>{site.name} · Top keywords</SheetTitle>
                    <SheetDescription>
                      Tap a column to sort · {sortedKeywords.length} queries ·{" "}
                      {formatNumber(keywordClickTotal)} /{" "}
                      {formatNumber(siteClicks)} site clicks
                      {uncoveredClicks > 0
                        ? ` · ${formatNumber(uncoveredClicks)} outside list`
                        : ""}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <KeywordList
                      queries={sortedKeywords}
                      startIndex={0}
                      sort={keywordSort}
                      onSortKey={(key) =>
                        setKeywordSort(nextSeoSort(keywordSort, key))
                      }
                      showPosition={showPosition}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No keyword data yet — Sync now
            </p>
          )}
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

      {source === "bing" && (
        <div className="mt-3 border-t pt-3">
          {editing ? (
            <div className="space-y-2">
              <Label htmlFor={`prop-bing-${site.slug}`} className="text-xs">
                Bing site URL
              </Label>
              <Input
                id={`prop-bing-${site.slug}`}
                value={propertyUrl}
                onChange={(e) => setPropertyUrl(e.target.value)}
                placeholder="https://www.example.com/"
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
                    setPropertyUrl(bingOverride ?? "");
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
              {bingOverride
                ? "Edit Bing property"
                : "Set Bing property override"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SortHeaderButton({
  label,
  sortKey,
  sort,
  onSortKey,
  align = "right",
}: {
  label: string;
  sortKey: SeoSortKey;
  sort: SeoSort;
  onSortKey: (key: SeoSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSortKey(sortKey)}
      className={cn(
        "inline-flex items-center gap-0.5 font-semibold uppercase tracking-wide transition-colors",
        align === "right" ? "justify-self-end" : "justify-self-start",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
      aria-pressed={active}
      title={`Sort by ${label}`}
    >
      {label}
      {active ? (
        sort.dir === "desc" ? (
          <CaretDown size={10} weight="bold" />
        ) : (
          <CaretUp size={10} weight="bold" />
        )
      ) : null}
    </button>
  );
}

function KeywordList({
  queries,
  startIndex = 0,
  compact = false,
  sort,
  onSortKey,
  showPosition = true,
}: {
  queries: SeoTopQuery[];
  startIndex?: number;
  compact?: boolean;
  sort: SeoSort;
  onSortKey: (key: SeoSortKey) => void;
  showPosition?: boolean;
}) {
  const cols = compact
    ? "grid-cols-[minmax(0,1fr)_auto_auto]"
    : showPosition
      ? "grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_3.5rem_3rem]"
      : "grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_3.5rem]";

  return (
    <div className={cn("mt-1.5", !compact && "mt-0")}>
      <div
        className={cn(
          "grid gap-2 border-b border-border/60 pb-1.5 text-[10px]",
          cols
        )}
      >
        <SortHeaderButton
          label="Keyword"
          sortKey="name"
          sort={sort}
          onSortKey={onSortKey}
          align="left"
        />
        <SortHeaderButton
          label="Clicks"
          sortKey="clicks"
          sort={sort}
          onSortKey={onSortKey}
        />
        <SortHeaderButton
          label="Impr."
          sortKey="impressions"
          sort={sort}
          onSortKey={onSortKey}
        />
        {!compact && (
          <>
            <SortHeaderButton
              label="CTR"
              sortKey="ctr"
              sort={sort}
              onSortKey={onSortKey}
            />
            {showPosition && (
              <SortHeaderButton
                label="Pos"
                sortKey="position"
                sort={sort}
                onSortKey={onSortKey}
              />
            )}
          </>
        )}
      </div>
      <ol>
        {queries.map((q, i) => {
          const rank = startIndex + i + 1;
          return (
            <li
              key={`${q.query}-${rank}`}
              className={cn(
                "grid items-baseline gap-2 border-b border-border/40 py-2 text-sm last:border-0",
                cols
              )}
            >
              <span className="min-w-0 truncate text-foreground">
                <span className="mr-1.5 tabular-nums text-muted-foreground">
                  {rank}.
                </span>
                {q.query}
              </span>
              <span className="text-right tabular-nums text-xs font-semibold text-foreground">
                {formatNumber(q.clicks)}
              </span>
              <span className="text-right tabular-nums text-xs text-muted-foreground">
                {formatNumber(q.impressions)}
              </span>
              {!compact && (
                <>
                  <span className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatCtr(q.ctr)}
                  </span>
                  {showPosition && (
                    <span className="text-right tabular-nums text-xs text-muted-foreground">
                      {formatPosition(q.position)}
                    </span>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
