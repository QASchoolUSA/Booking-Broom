import { cn } from "@/lib/utils";

export type MetricDirection = "higher-better" | "lower-better";

export function formatSignedNumber(n: number, digits = 0): string {
  if (Math.abs(n) < 1 / Math.pow(10, digits + 1)) return "0";
  const rounded =
    digits === 0 ? Math.round(n) : Number(n.toFixed(digits));
  if (rounded === 0) return "0";
  const abs =
    digits === 0
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
          Math.abs(rounded)
        )
      : Math.abs(rounded).toFixed(digits);
  return `${rounded > 0 ? "+" : "−"}${abs}`;
}

export function formatSignedCtr(delta: number): string {
  const pct = delta * 100;
  if (Math.abs(pct) < 0.05) return "0%";
  const abs = Math.abs(pct).toFixed(1);
  return `${pct > 0 ? "+" : "−"}${abs}%`;
}

export function deltaTone(
  delta: number,
  direction: MetricDirection
): "up" | "down" | "flat" {
  if (Math.abs(delta) < 1e-9) return "flat";
  const improved =
    direction === "higher-better" ? delta > 0 : delta < 0;
  return improved ? "up" : "down";
}

export function deltaClassName(
  delta: number,
  direction: MetricDirection
): string {
  const tone = deltaTone(delta, direction);
  return cn(
    "text-[11px] font-medium tabular-nums",
    tone === "up" && "text-emerald-600 dark:text-emerald-400",
    tone === "down" && "text-rose-600 dark:text-rose-400",
    tone === "flat" && "text-muted-foreground"
  );
}
