"use client";

import { Broom } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  label?: string;
  className?: string;
};

/**
 * Branded full-area loader for dashboard route transitions.
 * Keeps the persistent AppShell chrome; only the page content area shows this.
 */
export function PageLoader({
  label = "Loading",
  className,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex min-h-[min(24rem,60dvh)] flex-1 flex-col items-center justify-center gap-4 px-6 py-16",
        className
      )}
    >
      <div className="relative flex size-16 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
        />
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary motion-safe:animate-pulse"
        >
          <Broom size={24} weight="duotone" className="size-6" />
        </span>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
