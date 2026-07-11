import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<BookingStatus, string> = {
  new: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/15 dark:text-primary dark:border-primary/25",
  confirmed:
    "bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  assigned:
    "bg-violet-100 text-violet-800 border-violet-200/80 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  completed:
    "bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  cancelled:
    "bg-red-100 text-red-700 border-red-200/80 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
};

const statusLabels: Record<BookingStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  assigned: "Assigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface StatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-none",
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
