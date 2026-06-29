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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: `${site.accent_color}18`,
        borderColor: `${site.accent_color}40`,
        color: site.accent_color,
      }}
    >
      {site.name}
    </span>
  );
}
