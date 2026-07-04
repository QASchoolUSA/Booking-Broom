"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarBlank,
  Envelope,
  MapPin,
  Phone,
  Trash,
  User,
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
  onDelete: (id: string) => Promise<void>;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-2.5">
      <Icon size={18} className="mt-0.5 shrink-0 text-muted-foreground" weight="duotone" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

export function BookingDetailSheet({
  booking,
  open,
  onOpenChange,
  onStatusChange,
  onNotesChange,
  onDelete,
}: BookingDetailSheetProps) {
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    if (booking) {
      setInternalNotes(booking.internal_notes ?? "");
    }
  }, [booking]);

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
    }
  }, [open]);

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

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete(booking.id);
      toast.success("Booking deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete booking");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Header */}
        <SheetHeader className="border-b bg-muted/30 px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            {booking.site && <SiteBadge site={booking.site} />}
            <StatusBadge status={booking.status} />
          </div>
          <SheetTitle className="flex items-center gap-2 text-left text-lg">
            <User size={20} weight="duotone" className="text-muted-foreground" />
            {booking.customer_name
          }</SheetTitle>
          <SheetDescription className="text-left">
            {booking.service_type} · Received{" "}
            {format(parseISO(booking.created_at), "MMM d, yyyy 'at' h:mm a")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 py-5">
          {/* Contact details */}
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Contact
            </h4>
            <div className="divide-y divide-border rounded-xl border bg-card">
              {booking.email && (
                <DetailRow icon={Envelope} label="Email">
                  <a href={`mailto:${booking.email}`} className="break-all text-primary hover:underline">
                    {booking.email}
                  </a>
                </DetailRow>
              )}
              {booking.phone && (
                <DetailRow icon={Phone} label="Phone">
                  <a href={`tel:${booking.phone}`} className="text-primary hover:underline">
                    {booking.phone}
                  </a>
                </DetailRow>
              )}
              {booking.address && (
                <DetailRow icon={MapPin} label="Address">
                  {booking.address}
                </DetailRow>
              )}
              {booking.preferred_date && (
                <DetailRow icon={CalendarBlank} label="Preferred date">
                  {format(parseISO(booking.preferred_date), "EEEE, MMM d, yyyy")}
                  {booking.preferred_time && ` · ${booking.preferred_time}`}
                </DetailRow>
              )}
            </div>
          </section>

          {booking.notes && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Customer notes
              </h4>
              <p className="rounded-xl border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground">
                {booking.notes}
              </p>
            </section>
          )}

          <Separator />

          {/* Status */}
          <section className="space-y-2">
            <Label htmlFor="status" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Status
            </Label>
            <Select
              value={booking.status}
              onValueChange={(v) => v && handleStatusChange(v as BookingStatus)}
              disabled={saving}
            >
              <SelectTrigger id="status" className="h-11 w-full">
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
          </section>

          {/* Internal notes */}
          <section className="space-y-2">
            <Label htmlFor="internal-notes" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Internal notes
            </Label>
            <Textarea
              id="internal-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.currentTarget.value)}
              placeholder="Notes visible only to managers…"
              rows={4}
              className="resize-none"
            />
            <Button onClick={handleSaveNotes} disabled={saving} className="h-11 w-full">
              Save notes
            </Button>
          </section>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => handleStatusChange("confirmed")}
              disabled={saving || booking.status === "confirmed"}
            >
              Confirm
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              onClick={() => handleStatusChange("cancelled")}
              disabled={saving || booking.status === "cancelled"}
            >
              Cancel
            </Button>
          </div>

          <Separator />

          <section>
            {confirmDelete ? (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm leading-relaxed">
                  Permanently delete{" "}
                  <span className="font-medium">{booking.customer_name}</span>
                  &apos;s booking? This cannot be undone.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving}
                  >
                    Keep booking
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-11"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="destructive"
                className="h-11 w-full gap-2"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                <Trash size={18} weight="duotone" />
                Delete booking
              </Button>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
