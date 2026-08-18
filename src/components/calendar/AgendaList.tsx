"use client";

import { format, isSameDay, parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { formatEventTime } from "@/lib/calendar-utils";
import { EventBlock } from "@/components/calendar/EventBlock";
import { cn } from "@/lib/utils";

interface AgendaListProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

export function AgendaList({ events, onSelectEvent }: AgendaListProps) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = format(new Date(ev.start_at_ms), "yyyy-MM-dd");
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }

  const days = Array.from(groups.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (days.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
        Nothing scheduled in this period.
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto p-4">
      {days.map(([ymd, dayEvents]) => {
        const day = parseISO(ymd);
        const today = isSameDay(day, new Date());
        return (
          <section key={ymd}>
            <h3
              className={cn(
                "mb-2 flex items-baseline gap-2 text-sm font-semibold",
                today && "text-primary"
              )}
            >
              <span>{format(day, "EEEE")}</span>
              <span className="text-muted-foreground">
                {format(day, "MMM d")}
              </span>
              {today && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Today
                </span>
              )}
            </h3>
            <ul className="space-y-2">
              {dayEvents.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <div className="w-20 shrink-0 pt-2 text-right text-xs font-medium text-muted-foreground">
                    {formatEventTime(ev)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <EventBlock event={ev} onClick={onSelectEvent} />
                    {ev.site && (
                      <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                        {ev.site.name}
                        {ev.subtitle ? ` · ${ev.subtitle}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
