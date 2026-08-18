"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { Bell, CalendarCheck } from "@phosphor-icons/react";
import type { BookingWithSite, Reminder } from "@/lib/types";
import { DEFAULT_TZ } from "@/lib/calendar-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ALERT_PRESETS = [
  { minutes: 1440, label: "1 day before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 0, label: "At start time" },
] as const;

interface ScheduleJobFieldsProps {
  booking: BookingWithSite;
  onScheduled?: () => void;
}

function toDateInput(ms: number | null, tz: string): string {
  if (!ms) return "";
  return format(toZonedTime(ms, tz), "yyyy-MM-dd");
}

function toTimeInput(ms: number | null, tz: string): string {
  if (!ms) return "09:00";
  return format(toZonedTime(ms, tz), "HH:mm");
}

export function ScheduleJobFields({
  booking,
  onScheduled,
}: ScheduleJobFieldsProps) {
  const schedule = useMutation(api.bookings.schedule);
  const createReminder = useMutation(api.reminders.create);
  const removeReminder = useMutation(api.reminders.remove);
  const remindersRaw = useQuery(api.reminders.listByBooking, {
    bookingId: booking.id as Id<"bookings">,
  });
  const reminders = (remindersRaw ?? []) as Reminder[];

  const tz = booking.timezone || DEFAULT_TZ;
  const [date, setDate] = useState(
    toDateInput(booking.scheduled_start_at_ms, tz) ||
      booking.preferred_date ||
      format(new Date(), "yyyy-MM-dd")
  );
  const [startTime, setStartTime] = useState(
    toTimeInput(booking.scheduled_start_at_ms, tz)
  );
  const [endTime, setEndTime] = useState(
    toTimeInput(
      booking.scheduled_end_at_ms ??
        (booking.scheduled_start_at_ms
          ? booking.scheduled_start_at_ms + 3 * 60 * 60 * 1000
          : null),
      tz
    )
  );
  const [alerts, setAlerts] = useState<number[]>([1440, 60]);
  const [saving, setSaving] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [addingReminder, setAddingReminder] = useState(false);

  useEffect(() => {
    setDate(
      toDateInput(booking.scheduled_start_at_ms, tz) ||
        booking.preferred_date ||
        format(new Date(), "yyyy-MM-dd")
    );
    setStartTime(toTimeInput(booking.scheduled_start_at_ms, tz));
    setEndTime(
      toTimeInput(
        booking.scheduled_end_at_ms ??
          (booking.scheduled_start_at_ms
            ? booking.scheduled_start_at_ms + 3 * 60 * 60 * 1000
            : null),
        tz
      )
    );
  }, [booking.id, booking.scheduled_start_at_ms, booking.scheduled_end_at_ms, booking.preferred_date, tz]);

  const parseSlot = () => {
    const [sy, sm, sd] = date.split("-").map(Number);
    const [sh, smin] = startTime.split(":").map(Number);
    const [eh, emin] = endTime.split(":").map(Number);
    const startAt = fromZonedTime(
      new Date(sy, sm - 1, sd, sh, smin, 0),
      tz
    ).getTime();
    const endAt = fromZonedTime(
      new Date(sy, sm - 1, sd, eh, emin, 0),
      tz
    ).getTime();
    return { startAt, endAt };
  };

  const handleSchedule = async (confirm: boolean) => {
    setSaving(true);
    try {
      const { startAt, endAt } = parseSlot();
      const existingOffsets = new Set(
        reminders
          .filter((r) => r.offset_minutes != null)
          .map((r) => r.offset_minutes as number)
      );
      const newOffsets = booking.scheduled_start_at_ms
        ? alerts.filter((a) => !existingOffsets.has(a))
        : alerts;

      await schedule({
        bookingId: booking.id as Id<"bookings">,
        scheduledStartAt: startAt,
        scheduledEndAt: endAt,
        timezone: tz,
        confirm,
        alertOffsetsMinutes: newOffsets,
      });
      toast.success(confirm ? "Job scheduled & confirmed" : "Job scheduled");
      onScheduled?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await schedule({
        bookingId: booking.id as Id<"bookings">,
        scheduledStartAt: null,
      });
      toast.success("Schedule cleared");
      onScheduled?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStandalone = async () => {
    if (!reminderTitle.trim()) {
      toast.error("Enter a reminder title");
      return;
    }
    setAddingReminder(true);
    try {
      const dueAt = booking.scheduled_start_at_ms
        ? booking.scheduled_start_at_ms - 60 * 60 * 1000
        : Date.now() + 60 * 60 * 1000;
      await createReminder({
        title: reminderTitle.trim(),
        bookingId: booking.id as Id<"bookings">,
        dueAt,
      });
      setReminderTitle("");
      toast.success("Reminder added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add reminder");
    } finally {
      setAddingReminder(false);
    }
  };

  const sectionHeading =
    "mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground";

  return (
    <div className="space-y-5">
      <section>
        <h4 className={sectionHeading}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarCheck size={14} weight="duotone" />
            Schedule job
          </span>
        </h4>
        <div className="space-y-3 rounded-xl border bg-card p-3.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <Label htmlFor="job-date" className="text-[11px]">
                Date
              </Label>
              <Input
                id="job-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.currentTarget.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-start" className="text-[11px]">
                Start
              </Label>
              <Input
                id="job-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.currentTarget.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-end" className="text-[11px]">
                End
              </Label>
              <Input
                id="job-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.currentTarget.value)}
                className="h-10"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Timezone: {tz}
          </p>
          {!booking.scheduled_start_at_ms && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Manager alerts
              </p>
              <div className="flex flex-wrap gap-2">
                {ALERT_PRESETS.map((p) => {
                  const checked = alerts.includes(p.minutes);
                  return (
                    <label
                      key={p.minutes}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAlerts((prev) =>
                            checked
                              ? prev.filter((m) => m !== p.minutes)
                              : [...prev, p.minutes]
                          )
                        }
                        className="size-3.5"
                      />
                      {p.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-10"
              onClick={() => handleSchedule(true)}
              disabled={saving}
            >
              {booking.scheduled_start_at_ms
                ? "Update schedule"
                : "Schedule & confirm"}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => handleSchedule(false)}
              disabled={saving}
            >
              Save schedule
            </Button>
          </div>
          {booking.scheduled_start_at_ms && (
            <Button
              variant="ghost"
              className="h-9 w-full text-muted-foreground"
              onClick={handleClear}
              disabled={saving}
            >
              Clear schedule
            </Button>
          )}
        </div>
      </section>

      <section>
        <h4 className={sectionHeading}>
          <span className="inline-flex items-center gap-1.5">
            <Bell size={14} weight="duotone" />
            Reminders
          </span>
        </h4>
        <div className="space-y-2 rounded-xl border bg-card p-3.5">
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reminders linked to this booking.
            </p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(r.due_at_ms), "MMM d · h:mm a")}
                      {r.status === "sent" ? " · Sent" : ""}
                      {r.offset_minutes != null
                        ? ` · ${r.offset_minutes}m before`
                        : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="shrink-0 text-destructive"
                    onClick={async () => {
                      try {
                        await removeReminder({
                          reminderId: r.id as Id<"reminders">,
                        });
                        toast.success("Reminder removed");
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Failed"
                        );
                      }
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <Input
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.currentTarget.value)}
              placeholder="Add reminder…"
              className="h-9"
            />
            <Button
              size="sm"
              className="h-9 shrink-0"
              onClick={handleAddStandalone}
              disabled={addingReminder}
            >
              Add
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
