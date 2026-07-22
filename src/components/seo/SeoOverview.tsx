"use client";

import { CursorClick, Eye, Percent, Ranking } from "@phosphor-icons/react";
import type { SiteSeoRow } from "@/lib/types";
import {
  deltaClassName,
  formatSignedCtr,
  formatSignedNumber,
  type MetricDirection,
} from "@/lib/seoDeltas";
import { cn } from "@/lib/utils";

interface SeoOverviewProps {
  rows: SiteSeoRow[];
  source?: "google" | "bing";
  className?: string;
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

export function SeoOverview({ rows, source = "google", className }: SeoOverviewProps) {
  const showPosition = source === "google";
  const withMetrics = rows.filter((r) => r.metrics);
  const totalClicks = withMetrics.reduce((s, r) => s + (r.metrics?.clicks ?? 0), 0);
  const totalImpressions = withMetrics.reduce(
    (s, r) => s + (r.metrics?.impressions ?? 0),
    0
  );
  const avgCtr =
    totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  // Impression-weighted average position
  let weightedPos = 0;
  let weight = 0;
  for (const r of withMetrics) {
    const m = r.metrics!;
    if (m.impressions > 0 && m.position > 0) {
      weightedPos += m.position * m.impressions;
      weight += m.impressions;
    }
  }
  const avgPosition = weight > 0 ? weightedPos / weight : 0;

  const withDelta = withMetrics.filter((r) => r.delta);
  let clicksDelta: number | null = null;
  let impressionsDelta: number | null = null;
  let ctrDelta: number | null = null;
  let positionDelta: number | null = null;

  if (withDelta.length > 0) {
    clicksDelta = withDelta.reduce((s, r) => s + (r.delta?.clicks ?? 0), 0);
    impressionsDelta = withDelta.reduce(
      (s, r) => s + (r.delta?.impressions ?? 0),
      0
    );

    const prevClicks = totalClicks - clicksDelta;
    const prevImpressions = totalImpressions - impressionsDelta;
    const prevCtr =
      prevImpressions > 0 ? prevClicks / prevImpressions : 0;
    ctrDelta = avgCtr - prevCtr;

    let prevWeighted = 0;
    let prevWeight = 0;
    for (const r of withDelta) {
      const m = r.metrics!;
      const d = r.delta!;
      const prevImp = m.impressions - d.impressions;
      const prevPos = m.position - d.position;
      if (prevImp > 0 && prevPos > 0) {
        prevWeighted += prevPos * prevImp;
        prevWeight += prevImp;
      }
    }
    if (prevWeight > 0 && avgPosition > 0) {
      positionDelta = avgPosition - prevWeighted / prevWeight;
    }
  }

  const stats: {
    label: string;
    value: string;
    icon: typeof CursorClick;
    accent: string;
    deltaText: string | null;
    deltaValue: number;
    direction: MetricDirection;
  }[] = [
    {
      label: "Clicks",
      value: formatNumber(totalClicks),
      icon: CursorClick,
      accent: "text-primary bg-primary/10",
      deltaText:
        clicksDelta !== null ? formatSignedNumber(clicksDelta) : null,
      deltaValue: clicksDelta ?? 0,
      direction: "higher-better",
    },
    {
      label: "Impressions",
      value: formatNumber(totalImpressions),
      icon: Eye,
      accent: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-950",
      deltaText:
        impressionsDelta !== null
          ? formatSignedNumber(impressionsDelta)
          : null,
      deltaValue: impressionsDelta ?? 0,
      direction: "higher-better",
    },
    {
      label: "Avg CTR",
      value: withMetrics.length ? formatCtr(avgCtr) : "—",
      icon: Percent,
      accent:
        "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950",
      deltaText: ctrDelta !== null ? formatSignedCtr(ctrDelta) : null,
      deltaValue: ctrDelta ?? 0,
      direction: "higher-better",
    },
    ...(showPosition
      ? [
          {
            label: "Avg position",
            value: withMetrics.length ? formatPosition(avgPosition) : "—",
            icon: Ranking,
            accent:
              "text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950",
            deltaText:
              positionDelta !== null
                ? formatSignedNumber(positionDelta, 1)
                : null,
            deltaValue: positionDelta ?? 0,
            direction: "lower-better" as MetricDirection,
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        showPosition ? "lg:grid-cols-4" : "lg:grid-cols-3",
        className
      )}
    >
      {stats.map(({ label, value, icon: Icon, accent, deltaText, deltaValue, direction }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm sm:p-4"
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              accent
            )}
          >
            <Icon size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums leading-none tracking-tight">
              {value}
            </p>
            {deltaText && (
              <p className={cn("mt-1", deltaClassName(deltaValue, direction))}>
                {deltaText}
              </p>
            )}
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
