"use client";

import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Loading calendar…
        </div>
      }
    >
      <CalendarView />
    </Suspense>
  );
}
