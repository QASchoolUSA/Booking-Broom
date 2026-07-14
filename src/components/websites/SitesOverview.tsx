"use client";

import {
  CheckCircle,
  Question,
  WifiHigh,
  WifiSlash,
} from "@phosphor-icons/react";
import type { SiteOpsRow } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SitesOverviewProps {
  rows: SiteOpsRow[];
  className?: string;
}

export function SitesOverview({ rows, className }: SitesOverviewProps) {
  const online = rows.filter((r) => r.health?.status === "online").length;
  const offline = rows.filter((r) => r.health?.status === "offline").length;
  const unchecked = rows.filter((r) => r.health == null).length;
  const emailReady = rows.filter((r) => r.site.email_configured).length;

  const stats = [
    {
      label: "Online",
      value: String(online),
      icon: WifiHigh,
      accent:
        "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950",
    },
    {
      label: "Offline",
      value: String(offline),
      icon: WifiSlash,
      accent:
        "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950",
    },
    {
      label: "Unchecked",
      value: String(unchecked),
      icon: Question,
      accent: "text-muted-foreground bg-muted/60",
    },
    {
      label: "Email set up",
      value: `${emailReady}/${rows.length}`,
      icon: CheckCircle,
      accent:
        "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950",
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
