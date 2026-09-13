"use client";

import {
  CheckCircle,
  Hourglass,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { DeploymentRow } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DeploymentsOverviewProps {
  rows: DeploymentRow[];
  className?: string;
}

function outcomeBucket(
  row: DeploymentRow
): "success" | "failed" | "building" | "unknown" {
  if (!row.target.worker_name) return "unknown";
  const d = row.deployment;
  if (!d || (d.error && !d.build_uuid)) return "unknown";

  const status = (d.status ?? "").toLowerCase();
  if (
    status === "queued" ||
    status === "initializing" ||
    status === "running"
  ) {
    return "building";
  }

  const outcome = (d.build_outcome ?? "").toLowerCase();
  if (outcome === "success") return "success";
  if (
    outcome === "fail" ||
    outcome === "cancelled" ||
    outcome === "terminated"
  ) {
    return "failed";
  }
  return "unknown";
}

export function DeploymentsOverview({
  rows,
  className,
}: DeploymentsOverviewProps) {
  let success = 0;
  let failed = 0;
  let building = 0;
  let unknown = 0;
  let usageWarn = 0;

  for (const row of rows) {
    const bucket = outcomeBucket(row);
    if (bucket === "success") success += 1;
    else if (bucket === "failed") failed += 1;
    else if (bucket === "building") building += 1;
    else unknown += 1;

    const d = row.deployment;
    if (!d) continue;
    const used = d.requests_today;
    const limit = d.requests_limit;
    if (
      d.build_minutes_limit_reached === true ||
      (used != null && limit > 0 && used / limit >= 0.7)
    ) {
      usageWarn += 1;
    }
  }

  const stats = [
    {
      label: "Success",
      value: String(success),
      icon: CheckCircle,
      accent:
        "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950",
    },
    {
      label: "Failed",
      value: String(failed),
      icon: XCircle,
      accent: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950",
    },
    {
      label: "Building",
      value: String(building),
      icon: Hourglass,
      accent: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-950",
    },
    {
      label: "Usage alerts",
      value: String(usageWarn),
      icon: WarningCircle,
      accent:
        "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950",
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
