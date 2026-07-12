"use client";

import { Gauge, WarningCircle, CheckCircle, Robot } from "@phosphor-icons/react";
import type { SitePerformanceRow } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PerformanceOverviewProps {
  rows: SitePerformanceRow[];
  className?: string;
}

function avgScore(
  rows: SitePerformanceRow[],
  key:
    | "performance_score"
    | "accessibility_score"
    | "best_practices_score"
    | "seo_score"
    | "agentic_browsing_score"
): number | null {
  const values = rows
    .map((r) => r.metrics?.[key])
    .filter((n): n is number => typeof n === "number");
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function scoreTone(score: number | null): string {
  if (score == null) return "text-muted-foreground bg-muted/60";
  if (score >= 90) return "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950";
  if (score >= 50) return "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950";
  return "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950";
}

export function PerformanceOverview({
  rows,
  className,
}: PerformanceOverviewProps) {
  const withMetrics = rows.filter((r) => r.metrics && !r.metrics.error);
  const failed = rows.filter((r) => r.metrics?.error).length;
  const good = withMetrics.filter(
    (r) => (r.metrics?.performance_score ?? 0) >= 90
  ).length;

  const avgPerf = avgScore(withMetrics, "performance_score");
  const avgAgent = avgScore(withMetrics, "agentic_browsing_score");

  const stats = [
    {
      label: "Avg performance",
      value: avgPerf != null ? String(avgPerf) : "—",
      icon: Gauge,
      accent: scoreTone(avgPerf),
    },
    {
      label: "Avg agentic",
      value: avgAgent != null ? String(avgAgent) : "—",
      icon: Robot,
      accent: scoreTone(avgAgent),
    },
    {
      label: "Good (90+)",
      value: String(good),
      icon: CheckCircle,
      accent: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950",
    },
    {
      label: "Failed audits",
      value: String(failed),
      icon: WarningCircle,
      accent: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {stats.map(({ label, value, icon: Icon, accent }) => (
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
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
