"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Site } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface SiteFilterProps {
  sites: Site[];
  counts: Record<string, number>;
  totalCount: number;
}

export function SiteFilter({
  sites,
  counts,
  totalCount,
}: SiteFilterProps) {
  const pathname = usePathname();

  const chips = [
    { slug: undefined, name: "All", count: totalCount, href: "/" },
    ...sites.map((site) => ({
      slug: site.slug,
      name: site.name.replace(" Cleaning", ""),
      count: counts[site.slug] ?? 0,
      href: `/sites/${site.slug}`,
      accent: site.accent_color,
    })),
  ];

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-1">
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
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
              style={
                isActive && chip.slug
                  ? {
                      borderColor: (chip as { accent?: string }).accent,
                      backgroundColor: (chip as { accent?: string }).accent,
                    }
                  : undefined
              }
            >
              {chip.name}
              {chip.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {chip.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
