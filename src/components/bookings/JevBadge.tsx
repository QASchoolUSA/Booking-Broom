"use client";

import type { LeadJevScore } from "@/lib/types";
import { cn } from "@/lib/utils";

export function JevBadge({
  jev,
  className,
}: {
  jev: LeadJevScore | null | undefined;
  className?: string;
}) {
  if (!jev) return null;

  if (jev.is_junk) {
    const vendor =
      (jev.is_vendor_offer ?? 0) >= 0.8 &&
      (jev.is_spam_or_bot ?? 0) < (jev.is_vendor_offer ?? 0);
    return (
      <span
        className={cn(
          "rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400",
          className
        )}
      >
        {vendor ? "Vendor" : "Spam"}
      </span>
    );
  }

  if (jev.is_hot) {
    return (
      <span
        className={cn(
          "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400",
          className
        )}
      >
        Hot
        {jev.urgency === "today"
          ? " · Today"
          : jev.urgency === "this_week"
            ? " · Week"
            : ""}
      </span>
    );
  }

  if (jev.urgency === "today" || jev.urgency === "this_week") {
    return (
      <span
        className={cn(
          "rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400",
          className
        )}
      >
        {jev.urgency === "today" ? "Today" : "This week"}
      </span>
    );
  }

  return null;
}
