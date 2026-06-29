"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Site } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SiteSidebarProps {
  sites: Site[];
  counts: Record<string, number>;
  totalCount: number;
}

export function SiteSidebar({ sites, counts, totalCount }: SiteSidebarProps) {
  const pathname = usePathname();

  const links = [
    { slug: undefined, name: "All Bookings", count: totalCount, href: "/" },
    ...sites.map((site) => ({
      slug: site.slug,
      name: site.name,
      count: counts[site.slug] ?? 0,
      href: `/sites/${site.slug}`,
      accent: site.accent_color,
    })),
  ];

  return (
    <nav className="space-y-1">
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Sites
      </p>
      {links.map((link) => {
        const isActive =
          link.slug === undefined
            ? pathname === "/"
            : pathname === `/sites/${link.slug}`;

        return (
          <Link
            key={link.slug ?? "all"}
            href={link.href}
            className={cn(
              "flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
              isActive
                ? "bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {link.slug && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: (link as { accent?: string }).accent }}
                />
              )}
              <span className="truncate">{link.name}</span>
            </span>
            {link.count > 0 && (
              <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {link.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
