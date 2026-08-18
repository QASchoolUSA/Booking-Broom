"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { Bell, Trash } from "@phosphor-icons/react";
import { DEFAULT_TZ } from "@/lib/calendar-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface ReminderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill when creating */
  initialDueAt?: Date;
  initialBookingId?: string | null;
  /** Edit existing */
  reminderId?: string | null;
  onOpenBooking?: (bookingId: string) => void;
}

function toLocalInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function ReminderSheet({
  open,
  onOpenChange,
  initialDueAt,
  initialBookingId,
  reminderId,
  onOpenBooking,
}: ReminderSheetProps) {
  const existing = useQuery(
    api.reminders.get,
    open && reminderId
      ? { reminderId: reminderId as Id<"reminders"> }
      : "skip"
  );
  const createReminder = useMutation(api.reminders.create);
  const updateReminder = useMutation(api.reminders.update);
  const removeReminder = useMutation(api.reminders.remove);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueLocal, setDueLocal] = useState(() =>
    toLocalInputValue(initialDueAt ?? new Date())
  );
  const [allDay, setAllDay] = useState(false);
  const [bookingId, setBookingId] = useState(initialBookingId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setNotes(existing.notes ?? "");
      setDueLocal(toLocalInputValue(new Date(existing.due_at_ms)));
      setAllDay(existing.all_day);
      setBookingId(existing.booking_id ?? "");
    } else {
      setTitle("");
      setNotes("");
      setDueLocal(toLocalInputValue(initialDueAt ?? new Date()));
      setAllDay(false);
      setBookingId(initialBookingId ?? "");
    }
  }, [open, existing, initialDueAt, initialBookingId]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const localDate = new Date(dueLocal);
    if (Number.isNaN(localDate.getTime())) {
      toast.error("Invalid date/time");
      return;
    }
    // Treat datetime-local as America/New_York wall clock for consistency.
    const y = localDate.getFullYear();
    const m = localDate.getMonth();
    const d = localDate.getDate();
    const hh = allDay ? 9 : localDate.getHours();
    const mm = allDay ? 0 : localDate.getMinutes();
    const dueAt = fromZonedTime(
      new Date(y, m, d, hh, mm, 0),
      DEFAULT_TZ
    ).getTime();

    setSaving(true);
    try {
      if (reminderId) {
        await updateReminder({
          reminderId: reminderId as Id<"reminders">,
          title: title.trim(),
          notes: notes.trim() || undefined,
          dueAt,
          allDay,
          bookingId: bookingId
            ? (bookingId as Id<"bookings">)
            : null,
        });
        toast.success("Reminder updated");
      } else {
        await createReminder({
          title: title.trim(),
          notes: notes.trim() || undefined,
          dueAt,
          allDay,
          bookingId: bookingId
            ? (bookingId as Id<"bookings">)
            : undefined,
        });
        toast.success("Reminder created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!reminderId) return;
    setSaving(true);
    try {
      await removeReminder({ reminderId: reminderId as Id<"reminders"> });
      toast.success("Reminder removed");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b bg-muted/30 px-5 pb-4 pt-5 pr-12">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Bell size={20} weight="duotone" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Reminder
            </span>
          </div>
          <SheetTitle className="text-left text-lg font-semibold">
            {reminderId ? "Edit reminder" : "New reminder"}
          </SheetTitle>
          <SheetDescription className="text-left">
            Managers get a push notification at the due time.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="reminder-title">Title</Label>
            <Input
              id="reminder-title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder="Call customer / prep supplies…"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminder-due">Due</Label>
            <Input
              id="reminder-due"
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.currentTarget.value)}
              className="h-11"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.currentTarget.checked)}
              className="size-4 rounded border"
            />
            All day
          </label>
          <div className="space-y-2">
            <Label htmlFor="reminder-notes">Notes</Label>
            <Textarea
              id="reminder-notes"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminder-booking">Booking ID (optional)</Label>
            <Input
              id="reminder-booking"
              value={bookingId}
              onChange={(e) => setBookingId(e.currentTarget.value.trim())}
              placeholder="Link to a booking…"
              className="h-11 font-mono text-xs"
            />
            {bookingId && onOpenBooking && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onOpenBooking(bookingId)}
              >
                Open linked booking
              </Button>
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t bg-card px-5 py-4">
          <Button
            className="h-11 w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {reminderId ? "Save changes" : "Create reminder"}
          </Button>
          {reminderId && (
            <Button
              variant="outline"
              className="h-11 w-full gap-2 border-destructive/40 text-destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash size={16} />
              Delete reminder
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
