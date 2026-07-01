"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Site } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SiteFilterProps {
  sites: Site[];
  counts: Record<string, number>;
  totalCount: number;
}

export function SiteFilter({ sites, counts, totalCount }: SiteFilterProps) {
  const pathname = usePathname();

  const chips = [
    { slug: undefined, name: "All", count: totalCount, href: "/", accent: undefined },
    ...sites.map((site) => ({
      slug: site.slug,
      name: site.name.replace(" Cleaning", ""),
      count: counts[site.slug] ?? 0,
      href: `/sites/${site.slug}`,
      accent: site.accent_color,
    })),
  ];

  return (
    <div className="-mx-4 px-4">
      <div className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => {
          const isActive =
            chip.slug === undefined
              ? pathname === "/"
              : pathname === `/sites/${chip.slug}`;

          return (
            <Link
              key={chip.slug ?? "all"}
              href={chip.href}
              className={cn(
                "inline-flex min-h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "border-transparent text-white shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted/50"
              )}
              style={
                isActive
                  ? {
                      backgroundColor: chip.accent ?? "var(--primary)",
                      borderColor: chip.accent ?? "var(--primary)",
                    }
                  : undefined
              }
            >
              {chip.slug && !isActive && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chip.accent }}
                />
              )}
              {chip.name}
              {chip.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                    isActive ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {chip.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
