"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowCounterClockwise, CaretDown, ArrowSquareOut } from "@phosphor-icons/react";
import type { PricingConfig } from "convex/lib/pricingConfigs";
import {
  CANONICAL_SERVICE_LABELS,
  PRICING_ENGINE_LABELS,
} from "convex/lib/pricingConfigs";
import {
  computeReferenceBasket,
  REFERENCE_BASKET_LABEL,
} from "convex/lib/pricingEngines";
import {
  countChangedFields,
  describePricingConfig,
  fieldFromDisplay,
  fieldPrefix,
  fieldStep,
  fieldSuffix,
  fieldToDisplay,
  getAtPath,
  setAtPath,
  type PricingField,
} from "@/lib/pricing-fields";
import { formatMoney } from "@/lib/booking-details";
import type { SitePricingRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SitePricingCardProps {
  row: SitePricingRow;
}

export function SitePricingCard({ row }: SitePricingCardProps) {
  const { site, pricing } = row;
  const updateConfig = useMutation(api.pricing.updateConfig);
  const resetToDefaults = useMutation(api.pricing.resetToDefaults);

  /** The page keys this card on the saved version, so a remount reseeds the draft. */
  const [draft, setDraft] = useState<PricingConfig | null>(pricing?.config ?? null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(
    () => (draft ? describePricingConfig(draft) : []),
    [draft]
  );

  const changed = useMemo(
    () =>
      pricing && draft ? countChangedFields(pricing.config, draft) : 0,
    [pricing, draft]
  );

  const preview = useMemo(
    () => (draft ? computeReferenceBasket(draft) : null),
    [draft]
  );

  const siteHref = `https://${site.domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;

  if (!pricing || !draft) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: site.accent_color }}
            />
            {site.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No pricing configured. Run the pricing seed to import this site&apos;s
            current numbers.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig({
        siteId: site.id as Id<"sites">,
        config: draft,
        summary: `${changed} field${changed === 1 ? "" : "s"} changed`,
      });
      toast.success(`Saved pricing for ${site.name}`, {
        description: "Sites pick up new prices within a few minutes.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await resetToDefaults({ siteId: site.id as Id<"sites"> });
      toast.success(`${site.name} restored to its shipped prices`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: PricingField, raw: string) => {
    if (field.kind === "text") {
      setDraft((current) => (current ? setAtPath(current, field.path, raw) : current));
      return;
    }
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setDraft((current) =>
      current
        ? setAtPath(current, field.path, fieldFromDisplay(field.kind, parsed))
        : current
    );
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex min-w-0 items-center gap-2.5 text-base">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: site.accent_color }}
              />
              <a
                href={siteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline"
              >
                {site.name}
              </a>
              <ArrowSquareOut size={14} className="shrink-0 text-muted-foreground" />
            </CardTitle>
            <p className="pl-5 text-xs text-muted-foreground">
              {PRICING_ENGINE_LABELS[pricing.engine]} · v{pricing.version}
            </p>
          </div>
          {changed > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {changed} unsaved
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {preview && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              {REFERENCE_BASKET_LABEL}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(preview.entries).map(([key, entry]) => (
                <span key={key} className="text-xs">
                  <span className="text-muted-foreground">
                    {CANONICAL_SERVICE_LABELS[
                      key as keyof typeof CANONICAL_SERVICE_LABELS
                    ]}
                  </span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatMoney(entry.price)}
                  </span>
                </span>
              ))}
            </div>
            {preview.gaps.length > 0 && (
              <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                Marketed with no price:{" "}
                {preview.gaps
                  .map((gap) => CANONICAL_SERVICE_LABELS[gap])
                  .join(", ")}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/60"
        >
          {expanded ? "Hide prices" : "Edit prices"}
          <CaretDown
            size={14}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>

        {expanded && (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.title} className="space-y-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </h4>
                  {group.description && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {group.description}
                    </p>
                  )}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {group.fields.map((field) => {
                    const id = `${site.slug}-${field.path.join("-")}`;
                    const value = getAtPath(draft, field.path);
                    const prefix = fieldPrefix(field.kind);
                    const suffix = fieldSuffix(field.kind);
                    const original = getAtPath(pricing.config, field.path);
                    const isDirty = value !== original;

                    return (
                      <div key={id} className="space-y-1">
                        <Label
                          htmlFor={id}
                          className="text-xs text-muted-foreground"
                        >
                          {field.label}
                        </Label>
                        <div className="relative">
                          {prefix && (
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {prefix}
                            </span>
                          )}
                          <Input
                            id={id}
                            type={field.kind === "text" ? "text" : "number"}
                            step={
                              field.kind === "text"
                                ? undefined
                                : fieldStep(field.kind)
                            }
                            inputMode={
                              field.kind === "text" ? undefined : "decimal"
                            }
                            value={
                              field.kind === "text"
                                ? String(value ?? "")
                                : fieldToDisplay(
                                    field.kind,
                                    typeof value === "number" ? value : 0
                                  )
                            }
                            onChange={(e) => setField(field, e.target.value)}
                            className={cn(
                              "h-9",
                              prefix && "pl-6",
                              suffix && "pr-16",
                              isDirty && "border-primary"
                            )}
                          />
                          {suffix && (
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {suffix}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={changed === 0 || saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          {changed > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => setDraft(pricing.config)}
            >
              Discard
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto gap-1.5 text-muted-foreground"
            disabled={saving}
            onClick={handleReset}
          >
            <ArrowCounterClockwise size={13} />
            Shipped prices
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
