"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  CaretDown,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import type { PricingConfig } from "convex/lib/pricingConfigs";
import { CANONICAL_SERVICE_LABELS } from "convex/lib/pricingConfigs";
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
  type PricingFieldKind,
} from "@/lib/pricing-fields";
import { engineBlurb, engineLabel } from "@/lib/pricing-copy";
import { formatMoney } from "@/lib/booking-details";
import type { SitePricingRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PricingHistorySheet } from "@/components/pricing/PricingHistorySheet";
import { cn } from "@/lib/utils";

interface SitePricingEditorProps {
  row: SitePricingRow;
  /** Report dirty field count so the site list can show an unsaved badge. */
  onDirtyChange?: (changed: number) => void;
}

function unitChip(kind: PricingFieldKind): string | null {
  switch (kind) {
    case "money":
    case "money2":
    case "cents":
      return "$";
    case "rate":
      return "$ / sq ft";
    case "multiplier":
      return "×";
    case "percent":
      return "%";
    case "int":
      return "#";
    default:
      return null;
  }
}

function formatStoredForHint(
  kind: PricingFieldKind,
  value: unknown
): string | null {
  if (kind === "text") return typeof value === "string" ? value : null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const display = fieldToDisplay(kind, value);
  switch (kind) {
    case "money":
    case "money2":
    case "cents":
      return formatMoney(display);
    case "rate":
      return `$${display} / sq ft`;
    case "multiplier":
      return `×${display}`;
    case "percent":
      return `${display}%`;
    default:
      return String(display);
  }
}

export function SitePricingEditor({
  row,
  onDirtyChange,
}: SitePricingEditorProps) {
  const { site, pricing } = row;
  const updateConfig = useMutation(api.pricing.updateConfig);
  const resetToDefaults = useMutation(api.pricing.resetToDefaults);

  const [draft, setDraft] = useState<PricingConfig | null>(
    pricing?.config ?? null
  );
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Empty = all sections open (default). Titles listed here are collapsed. */
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set()
  );

  const groups = useMemo(
    () => (draft ? describePricingConfig(draft) : []),
    [draft]
  );

  const changed = useMemo(
    () => (pricing && draft ? countChangedFields(pricing.config, draft) : 0),
    [pricing, draft]
  );

  useEffect(() => {
    onDirtyChange?.(changed);
  }, [changed, onDirtyChange]);

  const preview = useMemo(
    () => (draft ? computeReferenceBasket(draft) : null),
    [draft]
  );

  const siteHref = `https://${site.domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;

  if (!pricing || !draft) {
    return (
      <div className="flex h-full min-h-[280px] flex-col justify-center rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: site.accent_color }}
          />
          <h3 className="text-base font-semibold">{site.name}</h3>
        </div>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          This site has no pricing configured yet. Ask a developer to import the
          numbers it currently ships with, then refresh this page.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Developer note:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            convex run internal.seed.syncSeedPricing
          </code>
        </p>
      </div>
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
      setDraft((current) =>
        current ? setAtPath(current, field.path, raw) : current
      );
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

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: site.accent_color }}
              />
              <h3 className="truncate text-base font-semibold">{site.name}</h3>
              <a
                href={siteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open site
                <ArrowSquareOut size={12} />
              </a>
            </div>
            <p className="pl-5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {engineLabel(pricing.engine)}
              </span>
              <span className="mx-1.5 text-border">·</span>
              v{pricing.version}
            </p>
            <p className="max-w-xl pl-5 text-xs text-muted-foreground">
              {engineBlurb(pricing.engine)}
            </p>
          </div>
          {changed > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {changed} unsaved
            </Badge>
          )}
        </div>
      </div>

      {preview && (
        <div className="sticky top-0 z-10 border-b bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
          <p className="text-xs font-medium text-muted-foreground">
            Live quote for {REFERENCE_BASKET_LABEL}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(preview.entries).map(([key, entry]) => (
              <div
                key={key}
                className="rounded-lg border bg-muted/40 px-2.5 py-1.5"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {
                    CANONICAL_SERVICE_LABELS[
                      key as keyof typeof CANONICAL_SERVICE_LABELS
                    ]
                  }
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {entry.kind === "from" && (
                    <span className="mr-0.5 text-[10px] font-normal text-muted-foreground">
                      from
                    </span>
                  )}
                  {formatMoney(entry.price)}
                </p>
              </div>
            ))}
          </div>
          {preview.gaps.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              Marketed with no price:{" "}
              {preview.gaps
                .map((gap) => CANONICAL_SERVICE_LABELS[gap])
                .join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 space-y-2 px-4 py-4 sm:px-5">
        {groups.map((group) => {
          const open = !collapsedSections.has(group.title);
          return (
            <div
              key={group.title}
              className="overflow-hidden rounded-lg border bg-background"
            >
              <button
                type="button"
                onClick={() => toggleSection(group.title)}
                className="flex w-full cursor-pointer items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold">{group.title}</h4>
                  {group.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  )}
                </div>
                <CaretDown
                  size={14}
                  className={cn(
                    "mt-1 shrink-0 text-muted-foreground transition-transform duration-150",
                    open && "rotate-180"
                  )}
                />
              </button>
              {open && (
                <div className="grid gap-3 border-t px-3 py-3 sm:grid-cols-2">
                  {group.fields.map((field) => {
                    const id = `${site.slug}-${field.path.join("-")}`;
                    const value = getAtPath(draft, field.path);
                    const prefix = fieldPrefix(field.kind);
                    const suffix = fieldSuffix(field.kind);
                    const chip = unitChip(field.kind);
                    const original = getAtPath(pricing.config, field.path);
                    const isDirty = value !== original;
                    const originalHint = formatStoredForHint(
                      field.kind,
                      original
                    );

                    return (
                      <div key={id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label
                            htmlFor={id}
                            className="text-xs font-medium text-foreground"
                          >
                            {field.label}
                          </Label>
                          {chip && (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {chip}
                            </span>
                          )}
                        </div>
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
                        {isDirty && originalHint !== null && (
                          <p className="text-[11px] text-muted-foreground">
                            Was {originalHint}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
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
          className="gap-1.5 text-muted-foreground"
          disabled={saving}
          onClick={() => setHistoryOpen(true)}
        >
          <ClockCounterClockwise size={13} />
          History
        </Button>
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

      <PricingHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        siteId={site.id}
        siteName={site.name}
        currentVersion={pricing.version}
      />
    </div>
  );
}
