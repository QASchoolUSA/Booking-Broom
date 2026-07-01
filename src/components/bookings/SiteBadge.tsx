import type { Site } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SiteBadgeProps {
  site: Pick<Site, "name" | "accent_color">;
  className?: string;
}

export function SiteBadge({ site, className }: SiteBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[140px] items-center truncate rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-none",
        className
      )}
      style={{
        backgroundColor: `${site.accent_color}14`,
        borderColor: `${site.accent_color}35`,
        color: site.accent_color,
      }}
    >
      {site.name.replace(" Cleaning", "")}
    </span>
  );
}
