"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** Wider ghost button with label for sidebar footer */
  labeled?: boolean;
}

export function ThemeToggle({ className, labeled = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (labeled) {
    return (
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-10 w-full justify-start gap-2.5 px-3 text-muted-foreground hover:text-foreground",
          className
        )}
        onClick={toggle}
        aria-label={isDark ? "Switch to light theme" : "Switch to night theme"}
      >
        {isDark ? (
          <Sun size={18} className="size-[18px]" weight="duotone" />
        ) : (
          <Moon size={18} className="size-[18px]" weight="duotone" />
        )}
        {mounted ? (isDark ? "Light theme" : "Night theme") : "Theme"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("size-9 shrink-0", className)}
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to night theme"}
    >
      {isDark ? (
        <Sun size={18} weight="duotone" />
      ) : (
        <Moon size={18} weight="duotone" />
      )}
    </Button>
  );
}
