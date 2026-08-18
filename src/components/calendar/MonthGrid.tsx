"use client";

import { format } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import {
  eventsForDay,
  inCurrentMonth,
  isToday,
  monthCells,
} from "@/lib/calendar-utils";
import { EventBlock } from "@/components/calendar/EventBlock";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthGridProps {
  cursor: Date;
  events: CalendarEvent[];
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function MonthGrid({
  cursor,
  events,
  onSelectDay,
  onSelectEvent,
}: MonthGridProps) {
  const cells = monthCells(cursor);

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const dayEvents = eventsForDay(events, day);
          const outside = !inCurrentMonth(day, cursor);
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "flex min-h-[88px] flex-col gap-0.5 border-b border-r p-1.5 text-left transition-colors hover:bg-muted/40",
                outside && "bg-muted/20"
              )}
            >
              <span
                className={cn(
                  "mb-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  today && "bg-primary text-primary-foreground",
                  !today && outside && "text-muted-foreground/60",
                  !today && !outside && "text-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventBlock
                    key={ev.id}
                    event={ev}
                    compact
                    onClick={onSelectEvent}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="px-1 text-[10px] font-medium text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
