"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarBlank, Globe } from "@phosphor-icons/react";
import type { Site } from "@/lib/types";
import { useSidebarLayout } from "@/components/layout/SidebarLayoutContext";
import { cn } from "@/lib/utils";

interface SiteSidebarProps {
  sites: Site[];
  counts: Record<string, number>;
  totalCount: number;
}

function shortSiteName(name: string) {
  return name.replace(" Cleaning", "");
}

export function SiteSidebar({ sites, counts, totalCount }: SiteSidebarProps) {
  const pathname = usePathname();
  const { compact } = useSidebarLayout();

  const links = [
    {
      slug: undefined,
      name: "All Bookings",
      fullName: "All Bookings",
      count: totalCount,
      href: "/",
      accent: undefined as string | undefined,
    },
    ...sites.map((site) => ({
      slug: site.slug,
      name: shortSiteName(site.name),
      fullName: site.name,
      count: counts[site.slug] ?? 0,
      href: `/sites/${site.slug}`,
      accent: site.accent_color,
    })),
  ];

  return (
    <nav className="space-y-1">
      {!compact && (
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sites
        </p>
      )}
      {links.map((link) => {
        const isActive =
          link.slug === undefined
            ? pathname === "/"
            : pathname === `/sites/${link.slug}`;

        return (
          <Link
            key={link.slug ?? "all"}
            href={link.href}
            title={link.fullName}
            className={cn(
              "group relative flex min-h-10 items-center rounded-lg text-sm font-medium transition-all duration-150",
              compact
                ? "justify-center px-2 py-2"
                : "justify-between px-3 py-2 pl-3.5",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-muted/60"
            )}
          >
            {isActive && !compact && (
              <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
            )}
            <span
              className={cn(
                "flex min-w-0 items-center",
                compact ? "justify-center" : "gap-2.5"
              )}
            >
              <span className="flex size-[18px] shrink-0 items-center justify-center">
                {link.slug ? (
                  <span
                    className={cn(
                      "rounded-full ring-2 ring-sidebar",
                      compact ? "h-3 w-3" : "h-2.5 w-2.5",
                      isActive && compact && "ring-primary/40"
                    )}
                    style={{ backgroundColor: link.accent }}
                  />
                ) : (
                  <CalendarBlank
                    size={18}
                    weight={isActive ? "duotone" : "regular"}
                    className={cn(
                      "size-[18px]",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                )}
              </span>
              {!compact && <span className="truncate">{link.name}</span>}
            </span>
            {!compact && (
              <span
                className={cn(
                  "ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {link.count}
              </span>
            )}
          </Link>
        );
      })}

      {!compact && (
        <div className="mt-8 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
          <div className="flex items-start gap-2.5">
            <Globe
              size={16}
              className="mt-0.5 size-4 shrink-0 text-primary"
              weight="duotone"
            />
            <div>
              <p className="text-xs font-semibold text-sidebar-foreground">
                {sites.length} active sites
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Bookings sync in real time from your cleaning websites.
              </p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
