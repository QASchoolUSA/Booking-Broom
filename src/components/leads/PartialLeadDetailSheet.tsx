"use client";

import { format, parseISO } from "date-fns";
import { CalendarBlank, Envelope, MapPin, Phone } from "@phosphor-icons/react";
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
  const service = lead.service_type?.trim() || "Incomplete quote";
  const hasContact =
    Boolean(lead.email) ||
    Boolean(lead.phone) ||
    Boolean(lead.address) ||
    Boolean(lead.preferred_date);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b bg-muted/30 px-5 pb-4 pt-5 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            {lead.site && <SiteBadge site={lead.site} />}
            <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Abandoned
            </span>
            {lead.intent === "quote" && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Quote only
              </span>
            )}
            {lead.intent === "book" && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Book
              </span>
            )}
          </div>
          <SheetTitle className="min-w-0 truncate text-left text-lg font-semibold">
            {name}
          </SheetTitle>
          <SheetDescription className="text-left">
            {service} · Updated{" "}
            {format(parseISO(lead.updated_at), "MMM d, yyyy 'at' h:mm a")}
            {lead.last_step ? ` · Step: ${lead.last_step}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex-1 space-y-6 overflow-y-auto px-5 py-5"
          style={{
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          }}
        >
          {hasContact && (
            <section>
              <h4 className={sectionHeading}>Contact</h4>
              <div className="divide-y divide-border rounded-xl border bg-card">
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
                {(lead.preferred_date || lead.preferred_time) && (
                  <DetailRow icon={CalendarBlank} label="Preferred">
                    {[lead.preferred_date, lead.preferred_time]
                      .filter(Boolean)
                      .join(" · ")}
                  </DetailRow>
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
          )}

          {lead.property && (
            <section>
              <h4 className={sectionHeading}>Property</h4>
              <BookingPropertySection property={lead.property} />
            </section>
          )}

          {lead.quote && (
            <section>
              <h4 className={sectionHeading}>Estimate</h4>
              <BookingQuoteSection quote={lead.quote} />
            </section>
          )}

          {lead.attribution && (
            <section>
              <h4 className={sectionHeading}>Attribution</h4>
              <BookingAttributionSection attribution={lead.attribution} />
            </section>
          )}

          {lead.notes && (
            <section>
              <h4 className={sectionHeading}>Notes</h4>
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
