"use client";

import { format, parseISO } from "date-fns";
import { Envelope, MapPin, Phone } from "@phosphor-icons/react";
import type { PartialLeadWithSite } from "@/lib/types";
import {
  BookingAttributionSection,
  BookingPropertySection,
  BookingQuoteSection,
} from "@/components/bookings/BookingQuotePanel";
import { SiteBadge } from "@/components/bookings/SiteBadge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PartialLeadDetailSheetProps {
  lead: PartialLeadWithSite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sectionHeading =
  "mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground";

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
    <div className="flex items-start gap-3 px-3.5 py-2.5">
      <Icon
        size={18}
        className="mt-0.5 shrink-0 text-muted-foreground"
        weight="duotone"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export function PartialLeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: PartialLeadDetailSheetProps) {
  if (!lead) return null;

  const name = lead.customer_name?.trim() || "Unknown visitor";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-3 border-b pb-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Abandoned
            </span>
            {lead.intent && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {lead.intent}
              </span>
            )}
          </div>
          <SheetTitle className="text-xl">{name}</SheetTitle>
          <SheetDescription className="sr-only">
            Abandoned quote or booking details
          </SheetDescription>
          {lead.site && <SiteBadge site={lead.site} />}
          <p className="text-xs text-muted-foreground">
            Updated {format(parseISO(lead.updated_at), "MMM d, yyyy · h:mm a")}
            {lead.last_step ? ` · Step: ${lead.last_step}` : ""}
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <section>
            <h3 className={sectionHeading}>Contact</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              {lead.email && (
                <DetailRow icon={Envelope} label="Email">
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => copyText("Email", lead.email!)}
                  >
                    {lead.email}
                  </button>
                </DetailRow>
              )}
              {lead.phone && (
                <DetailRow icon={Phone} label="Phone">
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => copyText("Phone", lead.phone!)}
                  >
                    {lead.phone}
                  </button>
                </DetailRow>
              )}
              {lead.address && (
                <DetailRow icon={MapPin} label="Address">
                  {lead.address}
                </DetailRow>
              )}
              {!lead.email && !lead.phone && !lead.address && (
                <p className="px-3.5 py-3 text-sm text-muted-foreground">
                  No contact details beyond what triggered the save.
                </p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                >
                  Email
                </a>
              )}
              {lead.phone && (
                <a
                  href={`sms:${lead.phone.replace(/\D/g, "")}`}
                  className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                >
                  Text
                </a>
              )}
            </div>
          </section>

          {(lead.service_type ||
            lead.preferred_date ||
            lead.preferred_time) && (
            <section>
              <h3 className={sectionHeading}>Request</h3>
              <div className="rounded-xl border bg-card px-3.5 py-3 text-sm">
                {lead.service_type && (
                  <p>
                    <span className="text-muted-foreground">Service: </span>
                    {lead.service_type}
                  </p>
                )}
                {(lead.preferred_date || lead.preferred_time) && (
                  <p className="mt-1">
                    <span className="text-muted-foreground">Preferred: </span>
                    {[lead.preferred_date, lead.preferred_time]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </section>
          )}

          {lead.property && (
            <section>
              <h3 className={sectionHeading}>Property</h3>
              <BookingPropertySection property={lead.property} />
            </section>
          )}

          {lead.quote && (
            <section>
              <h3 className={sectionHeading}>Estimate</h3>
              <BookingQuoteSection quote={lead.quote} />
            </section>
          )}

          {lead.attribution && (
            <section>
              <h3 className={sectionHeading}>Attribution</h3>
              <BookingAttributionSection attribution={lead.attribution} />
            </section>
          )}

          {lead.notes && (
            <section>
              <h3 className={sectionHeading}>Notes</h3>
              <p className="rounded-xl border bg-card px-3.5 py-3 text-sm whitespace-pre-wrap">
                {lead.notes}
              </p>
            </section>
          )}

          <Separator />
          <p className="text-xs text-muted-foreground">
            Soft lead only — no confirmation email or SMS was sent. Follow up
            manually if you want to recover this visitor.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
