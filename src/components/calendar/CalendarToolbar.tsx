"use client";

import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarViewMode } from "@/lib/calendar-utils";

const VIEWS: { id: CalendarViewMode; label: string; short: string }[] = [
  { id: "month", label: "Month", short: "M" },
  { id: "week", label: "Week", short: "W" },
  { id: "day", label: "Day", short: "D" },
  { id: "agenda", label: "Agenda", short: "A" },
];

interface CalendarToolbarProps {
  title: string;
  view: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onAddReminder: () => void;
}

export function CalendarToolbar({
  title,
  view,
  onViewChange,
  onToday,
  onPrev,
  onNext,
  onAddReminder,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card/60 px-3 py-2.5 sm:gap-3 sm:px-4">
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onToday}
          aria-label="Go to today"
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPrev}
          aria-label="Previous period"
        >
          <CaretLeft size={16} weight="bold" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNext}
          aria-label="Next period"
        >
          <CaretRight size={16} weight="bold" />
        </Button>
      </div>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight sm:text-lg">
        {title}
      </h1>

      <div className="flex items-center gap-1.5">
        <div
          className="hidden rounded-lg border bg-muted/40 p-0.5 sm:inline-flex"
          role="tablist"
          aria-label="Calendar view"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => onViewChange(v.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === v.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <select
          className="h-8 rounded-lg border bg-card px-2 text-xs font-medium sm:hidden"
          value={view}
          onChange={(e) => onViewChange(e.target.value as CalendarViewMode)}
          aria-label="Calendar view"
        >
          {VIEWS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>

        <Button size="sm" className="h-8 gap-1" onClick={onAddReminder}>
          <Plus size={14} weight="bold" />
          <span className="hidden sm:inline">Reminder</span>
        </Button>
      </div>
    </div>
  );
}
