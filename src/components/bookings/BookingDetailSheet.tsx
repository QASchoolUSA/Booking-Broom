"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarBlank,
  Envelope,
  MapPin,
  Phone,
} from "@phosphor-icons/react";
import type { BookingWithSite, BookingStatus } from "@/lib/types";
import { SiteBadge } from "@/components/bookings/SiteBadge";
import { StatusBadge } from "@/components/bookings/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface BookingDetailSheetProps {
  booking: BookingWithSite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: BookingStatus) => Promise<void>;
  onNotesChange: (id: string, notes: string) => Promise<void>;
}

export function BookingDetailSheet({
  booking,
  open,
  onOpenChange,
  onStatusChange,
  onNotesChange,
}: BookingDetailSheetProps) {
  const [saving, setSaving] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (booking) {
      setInternalNotes(booking.internal_notes ?? "");
    }
    onOpenChange(next);
  };

  if (!booking) return null;

  const handleStatusChange = async (status: BookingStatus) => {
    setSaving(true);
    try {
      await onStatusChange(booking.id, status);
      toast.success(`Marked as ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onNotesChange(booking.id, internalNotes);
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            {booking.site && <SiteBadge site={booking.site} />}
            <StatusBadge status={booking.status} />
          </div>
          <SheetTitle className="text-left">{booking.customer_name}</SheetTitle>
          <SheetDescription className="text-left">
            {booking.service_type} · Received{" "}
            {format(parseISO(booking.created_at), "MMM d, yyyy 'at' h:mm a")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
            {booking.email && (
              <p className="flex items-center gap-2">
                <Envelope size={18} className="shrink-0 text-muted-foreground" />
                <a href={`mailto:${booking.email}`} className="text-sky-600 hover:underline">
                  {booking.email}
                </a>
              </p>
            )}
            {booking.phone && (
              <p className="flex items-center gap-2">
                <Phone size={18} className="shrink-0 text-muted-foreground" />
                <a href={`tel:${booking.phone}`} className="text-sky-600 hover:underline">
                  {booking.phone}
                </a>
              </p>
            )}
            {booking.address && (
              <p className="flex items-start gap-2">
                <MapPin size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                {booking.address}
              </p>
            )}
            {booking.preferred_date && (
              <p className="flex items-center gap-2">
                <CalendarBlank size={18} className="shrink-0 text-muted-foreground" />
                {format(parseISO(booking.preferred_date), "EEEE, MMM d, yyyy")}
                {booking.preferred_time && ` · ${booking.preferred_time}`}
              </p>
            )}
            {booking.notes && (
              <>
                <Separator />
                <p className="text-muted-foreground">{booking.notes}</p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={booking.status}
              onValueChange={(v) => v && handleStatusChange(v as BookingStatus)}
              disabled={saving}
            >
              <SelectTrigger id="status" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal-notes">Internal notes</Label>
            <Textarea
              id="internal-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.currentTarget.value)}
              placeholder="Notes visible only to managers…"
              rows={4}
            />
            <Button
              onClick={handleSaveNotes}
              disabled={saving}
              className="min-h-11 w-full"
            >
              Save notes
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-11 flex-1"
              onClick={() => handleStatusChange("confirmed")}
              disabled={saving || booking.status === "confirmed"}
            >
              Confirm
            </Button>
            <Button
              variant="destructive"
              className="min-h-11 flex-1"
              onClick={() => handleStatusChange("cancelled")}
              disabled={saving || booking.status === "cancelled"}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
