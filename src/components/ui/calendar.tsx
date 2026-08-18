"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-2",
        month: "space-y-2",
        month_caption: "flex justify-center relative items-center h-8",
        caption_label: "text-sm font-semibold",
        nav: "flex items-center gap-1 absolute inset-x-2 top-2",
        button_previous:
          "absolute left-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-muted",
        button_next:
          "absolute right-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-muted",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-8 font-medium text-[0.7rem] text-center",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm",
        day_button: cn(
          "size-8 rounded-md p-0 font-normal hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
