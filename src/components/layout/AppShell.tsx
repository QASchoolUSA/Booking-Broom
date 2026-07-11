"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Broom,
  CalendarBlank,
  GearSix,
  SignOut,
  WifiHigh,
  WifiSlash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

type ConnectionState = "connecting" | "live" | "offline" | "reconnecting";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  connectionState?: ConnectionState;
  onRefresh?: () => void;
  pageTitle?: string;
}

export function AppShell({
  children,
  sidebar,
  connectionState = "connecting",
  onRefresh,
  pageTitle,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const connectionLabel = {
    connecting: "Connecting…",
    live: "Live",
    offline: "Offline",
    reconnecting: "Reconnecting…",
  }[connectionState];

  const isLive = connectionState === "live";

  const navItems = [
    { href: "/", label: "Bookings", icon: CalendarBlank, match: (p: string) => p === "/" || p.startsWith("/sites") },
    { href: "/settings", label: "Settings", icon: GearSix, match: (p: string) => p === "/settings" },
  ];

  return (
    <div className="dashboard-bg flex min-h-dvh">
      {/* Desktop sidebar */}
      {sidebar && (
        <aside
          className="fixed inset-y-0 left-0 z-30 hidden w-[280px] flex-col border-r border-sidebar-border bg-sidebar md:flex"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Broom size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                Booking Broom
              </p>
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {isLive ? (
                  <WifiHigh size={12} weight="duotone" className="text-emerald-600" />
                ) : (
                  <WifiSlash size={12} weight="duotone" className="text-amber-600" />
                )}
                <span className={cn(isLive && "text-emerald-600", connectionState === "offline" && "text-amber-600")}>
                  {connectionLabel}
                </span>
                {isLive && (
                  <span className="relative ml-0.5 flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav className="mb-5 space-y-1">
              {navItems.map(({ href, label, icon: Icon, match }) => {
                const isActive = match(pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 pl-3.5 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-muted/60"
                    )}
                  >
                    {isActive && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <span className="flex size-[18px] shrink-0 items-center justify-center">
                      <Icon
                        size={18}
                        weight={isActive ? "duotone" : "regular"}
                        className={cn(
                          "size-[18px]",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </span>
                    {label}
                  </Link>
                );
              })}
            </nav>
            {sidebar}
          </div>

          <div className="shrink-0 space-y-0.5 border-t border-sidebar-border p-3">
            <ThemeToggle labeled />
            <Button
              variant="ghost"
              className="h-10 w-full justify-start gap-2.5 px-3 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <SignOut size={18} className="size-[18px]" />
              Sign out
            </Button>
          </div>
        </aside>
      )}

      {/* Main column */}
      <div className={cn("flex min-w-0 flex-1 flex-col", sidebar && "md:pl-[280px]")}>
        {/* Mobile header */}
        <header
          className="sticky top-0 z-20 border-b border-border/80 bg-card/90 backdrop-blur-md md:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Broom size={16} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-tight">
                  {pageTitle ?? "Booking Broom"}
                </h1>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground"
                >
                  {isLive ? (
                    <WifiHigh size={11} weight="duotone" className="text-emerald-600" />
                  ) : (
                    <WifiSlash size={11} weight="duotone" className="text-amber-600" />
                  )}
                  <span className={cn(isLive && "text-emerald-600")}>{connectionLabel}</span>
                </button>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Desktop top bar (when no sidebar context like settings) */}
        {!sidebar && (
          <header
            className="sticky top-0 z-20 hidden border-b border-border/80 bg-card/90 backdrop-blur-md md:flex"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex h-14 w-full items-center justify-between px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Broom size={20} weight="duotone" />
                </div>
                <span className="text-sm font-bold">Booking Broom</span>
              </div>
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleSignOut}>
                <SignOut size={18} className="size-[18px]" />
                Sign out
              </Button>
            </div>
          </header>
        )}

        <main
          className="flex-1 px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-lg items-stretch px-2 pt-1.5">
          {navItems.map(({ href, label, icon: Icon, match }) => {
            const isActive = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
                )}
                <Icon size={22} weight={isActive ? "duotone" : "regular"} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors active:text-foreground"
          >
            <SignOut size={22} />
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}
