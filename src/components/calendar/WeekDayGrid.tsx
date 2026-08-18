"use client";

import { format } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOUR_HEIGHT,
  eventsForDay,
  isToday,
  weekDays,
} from "@/lib/calendar-utils";
import { EventBlock } from "@/components/calendar/EventBlock";
import { cn } from "@/lib/utils";

interface WeekDayGridProps {
  cursor: Date;
  events: CalendarEvent[];
  mode: "week" | "day";
  onSelectEvent: (event: CalendarEvent) => void;
}

function layoutTimed(
  events: CalendarEvent[],
  dayStartMs: number
): Array<CalendarEvent & { top: number; height: number }> {
  const dayStartHour = DAY_START_HOUR;
  return events
    .filter((e) => !e.all_day && e.kind !== "reminder")
    .map((e) => {
      const startH =
        (e.start_at_ms - dayStartMs) / (60 * 60 * 1000) - dayStartHour;
      const endH =
        (e.end_at_ms - dayStartMs) / (60 * 60 * 1000) - dayStartHour;
      const top = Math.max(0, startH) * HOUR_HEIGHT;
      const height = Math.max(24, (endH - Math.max(0, startH)) * HOUR_HEIGHT);
      return { ...e, top, height };
    });
}

export function WeekDayGrid({
  cursor,
  events,
  mode,
  onSelectEvent,
}: WeekDayGridProps) {
  const days = mode === "day" ? [cursor] : weekDays(cursor);
  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i
  );
  const gridHeight = hours.length * HOUR_HEIGHT;

  return (
    <div className="flex h-full min-h-[560px] flex-col overflow-auto">
      <div
        className={cn(
          "sticky top-0 z-10 grid border-b bg-card",
          mode === "week" ? "grid-cols-[56px_repeat(7,1fr)]" : "grid-cols-[56px_1fr]"
        )}
      >
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="border-l px-2 py-2 text-center"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {format(day, "EEE")}
            </div>
            <div
              className={cn(
                "mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day) && "bg-primary text-primary-foreground"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day / reminders row */}
      <div
        className={cn(
          "grid border-b bg-muted/20",
          mode === "week" ? "grid-cols-[56px_repeat(7,1fr)]" : "grid-cols-[56px_1fr]"
        )}
      >
        <div className="px-1 py-2 text-[10px] font-medium text-muted-foreground">
          All day
        </div>
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day).filter(
            (e) => e.all_day || e.kind === "reminder"
          );
          return (
            <div
              key={`all-${day.toISOString()}`}
              className="flex flex-col gap-0.5 border-l p-1"
            >
              {dayEvents.map((ev) => (
                <EventBlock
                  key={ev.id}
                  event={ev}
                  compact
                  onClick={onSelectEvent}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "relative grid",
          mode === "week" ? "grid-cols-[56px_repeat(7,1fr)]" : "grid-cols-[56px_1fr]"
        )}
        style={{ height: gridHeight }}
      >
        <div className="relative">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground"
              style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }}
            >
              {format(new Date(2000, 0, 1, h), "ha")}
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const timed = layoutTimed(eventsForDay(events, day), dayStart.getTime());
          return (
            <div
              key={`col-${day.toISOString()}`}
              className="relative border-l"
              style={{ height: gridHeight }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }}
                />
              ))}
              {timed.map((ev) => (
                <div
                  key={ev.id}
                  className="absolute inset-x-1 z-[1]"
                  style={{ top: ev.top, height: ev.height }}
                >
                  <EventBlock
                    event={ev}
                    onClick={onSelectEvent}
                    className="h-full"
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
