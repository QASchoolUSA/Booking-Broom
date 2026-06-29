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
import { cn } from "@/lib/utils";

type ConnectionState = "connecting" | "live" | "offline" | "reconnecting";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  connectionState?: ConnectionState;
  onRefresh?: () => void;
}

export function AppShell({
  children,
  sidebar,
  connectionState = "connecting",
  onRefresh,
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

  return (
    <div className="flex min-h-dvh flex-col bg-[#F0F9FF] dark:bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Broom size={20} weight="duotone" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Booking Broom</h1>
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {connectionState === "live" ? (
                  <WifiHigh size={14} weight="duotone" className="text-emerald-600" />
                ) : (
                  <WifiSlash size={14} weight="duotone" className="text-amber-600" />
                )}
                <span
                  className={cn(
                    connectionState === "live" && "text-emerald-600",
                    connectionState === "offline" && "text-amber-600"
                  )}
                >
                  {connectionLabel}
                </span>
                {connectionState === "live" && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                )}
              </button>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <SignOut size={20} />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-4 md:px-6 md:py-6">
        {/* Tablet/Desktop sidebar */}
        {sidebar && (
          <aside className="hidden w-56 shrink-0 md:block lg:w-64">
            <div className="sticky top-24 rounded-2xl border bg-card p-4 shadow-sm">
              {sidebar}
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden"
        style={{
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2">
          {[
            { href: "/", label: "Bookings", icon: CalendarBlank },
            { href: "/settings", label: "Settings", icon: GearSix },
          ].map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" || pathname.startsWith("/sites") : pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-11 min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  isActive ? "text-sky-600" : "text-muted-foreground"
                )}
              >
                <Icon size={22} weight={isActive ? "duotone" : "regular"} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SignOut size={22} />
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}
