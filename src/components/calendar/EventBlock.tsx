"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/types";
import { formatEventTime, withAlpha } from "@/lib/calendar-utils";
import { Bell } from "@phosphor-icons/react";

interface EventBlockProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
}

export function EventBlock({
  event,
  compact,
  onClick,
  className,
}: EventBlockProps) {
  const isReminder = event.kind === "reminder";
  const isTentative = event.kind === "booking_tentative";
  const color = event.color;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      className={cn(
        "group w-full overflow-hidden rounded-md border text-left transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "hover:brightness-[0.97] dark:hover:brightness-110",
        isReminder && "border-amber-500/40 bg-amber-500/10",
        isTentative && "border-dashed",
        !isReminder && !isTentative && "border-transparent text-white",
        compact ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-2 py-1 text-xs",
        className
      )}
      style={
        isReminder
          ? undefined
          : {
              backgroundColor: isTentative
                ? withAlpha(color, 0.18)
                : color,
              borderColor: isTentative ? color : undefined,
              color: isTentative ? undefined : "#fff",
              borderLeftWidth: isTentative ? 3 : undefined,
              borderLeftColor: isTentative ? color : undefined,
            }
      }
      title={`${event.title}${event.subtitle ? ` · ${event.subtitle}` : ""}`}
    >
      <span className="flex items-start gap-1">
        {isReminder && (
          <Bell
            size={compact ? 10 : 12}
            weight="fill"
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{event.title}</span>
          {!compact && (
            <span
              className={cn(
                "block truncate opacity-90",
                isTentative && "text-muted-foreground"
              )}
            >
              {formatEventTime(event)}
              {isTentative ? " · Requested" : ""}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
