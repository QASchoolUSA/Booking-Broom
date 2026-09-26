"use client";

import { Minus, Plus, ArrowCounterClockwise } from "@phosphor-icons/react";
import type { PricingScenario } from "convex/lib/pricingEngines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CONDITION_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  SCENARIO_PRESETS,
  matchPresetId,
  type ScenarioPresetId,
} from "@/lib/pricing-scenario";

interface PricingScenarioBarProps {
  scenario: PricingScenario;
  addonOptions: { key: string; label: string }[];
  onChange: (next: PricingScenario) => void;
  onReset: () => void;
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="inline-flex h-9 items-center rounded-lg border bg-background">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="inline-flex size-9 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus size={14} weight="bold" />
        </button>
        <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="inline-flex size-9 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

export function PricingScenarioBar({
  scenario,
  addonOptions,
  onChange,
  onReset,
}: PricingScenarioBarProps) {
  const activePreset = matchPresetId(scenario);

  const patch = (partial: Partial<PricingScenario>) => {
    const next = { ...scenario, ...partial };
    if (partial.squareFeet !== undefined) {
      // Band keys are recomputed by the caller via scenarioFromInputs.
      onChange(next);
      return;
    }
    onChange(next);
  };

  const applyPreset = (id: ScenarioPresetId) => {
    const preset = SCENARIO_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({ ...preset.scenario, addonKeys: [] });
  };

  const toggleAddon = (key: string) => {
    const set = new Set(scenario.addonKeys);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange({ ...scenario, addonKeys: [...set] });
  };

  return (
    <div className="sticky top-0 z-30 space-y-4 rounded-xl border bg-card/95 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Preset
          </span>
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activePreset === preset.id
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="self-start sm:self-auto"
        >
          <ArrowCounterClockwise size={14} data-icon="inline-start" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stepper
          label="Bedrooms"
          value={scenario.bedrooms}
          min={0}
          max={8}
          onChange={(bedrooms) => patch({ bedrooms })}
        />
        <Stepper
          label="Bathrooms"
          value={scenario.bathrooms}
          min={1}
          max={8}
          onChange={(bathrooms) => patch({ bathrooms })}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scenario-sqft" className="text-xs text-muted-foreground">
            Square feet
          </Label>
          <Input
            id="scenario-sqft"
            type="number"
            min={400}
            max={10000}
            step={100}
            value={scenario.squareFeet}
            onChange={(e) => {
              const squareFeet = Number(e.target.value);
              if (!Number.isFinite(squareFeet)) return;
              patch({ squareFeet: Math.max(400, Math.min(10000, squareFeet)) });
            }}
            className="h-9 tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scenario-property" className="text-xs text-muted-foreground">
            Property
          </Label>
          <select
            id="scenario-property"
            value={scenario.propertyTypeKey}
            onChange={(e) => patch({ propertyTypeKey: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scenario-condition" className="text-xs text-muted-foreground">
            Condition
          </Label>
          <select
            id="scenario-condition"
            value={scenario.conditionKey}
            onChange={(e) => patch({ conditionKey: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {addonOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add-ons</p>
          <div className="flex flex-wrap gap-1.5">
            {addonOptions.map((addon) => {
              const active = scenario.addonKeys.includes(addon.key);
              return (
                <button
                  key={addon.key}
                  type="button"
                  onClick={() => toggleAddon(addon.key)}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {addon.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Applied only on sites that offer the matching add-on.
          </p>
        </div>
      )}
    </div>
  );
}
