"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Broom,
  CalendarBlank,
  CaretDoubleLeft,
  CaretDoubleRight,
  ChartLine,
  ChatCircle,
  CurrencyDollar,
  EnvelopeSimple,
  Gauge,
  GearSix,
  Globe,
  List,
  SignOut,
  WifiHigh,
  WifiSlash,
} from "@phosphor-icons/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarLayoutProvider,
  type SidebarPresentation,
} from "@/components/layout/SidebarLayoutContext";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "bb-sidebar-collapsed";
const SIDEBAR_EXPANDED_W = 280;
const SIDEBAR_COLLAPSED_W = 68;

type ConnectionState = "connecting" | "live" | "offline" | "reconnecting";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  connectionState?: ConnectionState;
  onRefresh?: () => void;
  pageTitle?: string;
  /** Full-bleed content (no max-width) for messenger-style pages. */
  contentWidth?: "default" | "full";
  /** Hide bottom padding reserved for mobile nav (e.g. when a chat composer owns it). */
  hideMobileNavPad?: boolean;
  /** Hide the mobile bottom tab bar (e.g. while viewing a conversation). */
  hideMobileNav?: boolean;
  /** Hide the mobile top branding header (e.g. immersive chat thread). */
  hideMobileHeader?: boolean;
}

type NavItem = {
  href: string;
  label: string;
  icon: typeof CalendarBlank;
  match: (p: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Bookings",
    icon: CalendarBlank,
    match: (p) => p === "/" || p.startsWith("/sites"),
  },
  {
    href: "/messages",
    label: "Messages",
    icon: ChatCircle,
    match: (p) => p === "/messages" || p.startsWith("/messages/"),
  },
  {
    href: "/email",
    label: "Email",
    icon: EnvelopeSimple,
    match: (p) => p === "/email" || p.startsWith("/email/"),
  },
  {
    href: "/websites",
    label: "Sites",
    icon: Globe,
    match: (p) => p === "/websites" || p.startsWith("/websites/"),
  },
  {
    href: "/seo",
    label: "SEO",
    icon: ChartLine,
    match: (p) => p === "/seo" || p.startsWith("/seo/"),
  },
  {
    href: "/performance",
    label: "Speed",
    icon: Gauge,
    match: (p) => p === "/performance" || p.startsWith("/performance/"),
  },
  {
    href: "/pricing",
    label: "Pricing",
    icon: CurrencyDollar,
    match: (p) => p === "/pricing" || p.startsWith("/pricing/"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: GearSix,
    match: (p) => p === "/settings",
  },
];

let sidebarCollapsedStore = false;
const sidebarCollapsedListeners = new Set<() => void>();

function readCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsedPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Ignore quota / private mode failures.
  }
}

function getSidebarCollapsed() {
  return sidebarCollapsedStore;
}

function setSidebarCollapsed(collapsed: boolean) {
  sidebarCollapsedStore = collapsed;
  writeCollapsedPreference(collapsed);
  sidebarCollapsedListeners.forEach((listener) => listener());
}

function subscribeSidebarCollapsed(listener: () => void) {
  sidebarCollapsedListeners.add(listener);
  return () => {
    sidebarCollapsedListeners.delete(listener);
  };
}

function hydrateSidebarCollapsedFromStorage() {
  const next = readCollapsedPreference();
  if (next !== sidebarCollapsedStore) {
    sidebarCollapsedStore = next;
    sidebarCollapsedListeners.forEach((listener) => listener());
  }
}

if (typeof window !== "undefined") {
  hydrateSidebarCollapsedFromStorage();
}

interface SidebarChromeProps {
  mode: SidebarPresentation;
  sidebar?: React.ReactNode;
  connectionState: ConnectionState;
  connectionLabel: string;
  isLive: boolean;
  pathname: string;
  emailUnread?: number;
  onRefresh?: () => void;
  onSignOut: () => void;
  onToggleCollapse?: () => void;
}

function SidebarChrome({
  mode,
  sidebar,
  connectionState,
  connectionLabel,
  isLive,
  pathname,
  emailUnread = 0,
  onRefresh,
  onSignOut,
  onToggleCollapse,
}: SidebarChromeProps) {
  const compact = mode === "collapsed";

  return (
    <SidebarLayoutProvider value={{ compact, presentation: mode }}>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          compact ? "justify-center px-2" : "gap-2 px-3"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-3",
            compact ? "justify-center" : "flex-1"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Broom size={20} weight="duotone" />
          </div>
          {!compact && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                Booking Broom
              </p>
              <button
                type="button"
                onClick={onRefresh}
                className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {isLive ? (
                  <WifiHigh
                    size={12}
                    weight="duotone"
                    className="text-emerald-600"
                  />
                ) : (
                  <WifiSlash
                    size={12}
                    weight="duotone"
                    className="text-amber-600"
                  />
                )}
                <span
                  className={cn(
                    isLive && "text-emerald-600",
                    connectionState === "offline" && "text-amber-600"
                  )}
                >
                  {connectionLabel}
                </span>
                {isLive && (
                  <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            </div>
          )}
        </div>
        {mode === "expanded" && onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <CaretDoubleLeft size={16} />
          </Button>
        )}
      </div>

      <div
        className={cn(
          "flex-1 overflow-y-auto py-4",
          compact ? "px-2" : "px-3"
        )}
      >
        <nav className={cn("mb-5 space-y-1", compact && "mb-3")}>
          {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
            const isActive = match(pathname);
            const showBadge = href === "/email" && emailUnread > 0;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "relative flex min-h-10 items-center rounded-lg text-sm font-medium transition-all duration-150",
                  compact
                    ? "justify-center px-2 py-2"
                    : "gap-2.5 px-3 py-2 pl-3.5",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-muted/60"
                )}
              >
                {isActive && !compact && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                )}
                <span className="relative flex size-[18px] shrink-0 items-center justify-center">
                  <Icon
                    size={18}
                    weight={isActive ? "duotone" : "regular"}
                    className={cn(
                      "size-[18px]",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {showBadge && compact && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                      {emailUnread > 99 ? "99+" : emailUnread}
                    </span>
                  )}
                </span>
                {!compact && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {showBadge && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground">
                        {emailUnread > 99 ? "99+" : emailUnread}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        {sidebar}
      </div>

      <div
        className={cn(
          "shrink-0 space-y-1 border-t border-sidebar-border",
          compact ? "p-2" : "p-3"
        )}
      >
        {mode === "collapsed" && onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="h-10 w-full justify-center px-0 text-muted-foreground hover:text-foreground"
            onClick={onToggleCollapse}
          >
            <CaretDoubleRight size={18} className="size-[18px]" />
          </Button>
        )}
        <Button
          variant="ghost"
          title="Sign out"
          className={cn(
            "h-10 text-muted-foreground hover:text-foreground",
            compact
              ? "w-full justify-center px-0"
              : "w-full justify-start gap-2.5 px-3"
          )}
          onClick={onSignOut}
        >
          <SignOut size={18} className="size-[18px]" />
          {!compact && "Sign out"}
        </Button>
      </div>
    </SidebarLayoutProvider>
  );
}

export function AppShell({
  children,
  sidebar,
  connectionState = "connecting",
  onRefresh,
  pageTitle,
  contentWidth = "default",
  hideMobileNavPad = false,
  hideMobileNav = false,
  hideMobileHeader = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const emailUnreadRaw = useQuery(
    api.email.countUnread,
    isAuthenticated ? {} : "skip"
  );
  const emailUnread =
    typeof emailUnreadRaw === "number" ? emailUnreadRaw : 0;

  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsed,
    () => false
  );

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileOpenPath, setMobileOpenPath] = useState(pathname);
  const drawerOpen = mobileOpen && mobileOpenPath === pathname;

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const toggleCollapsed = () => {
    setSidebarCollapsed(!getSidebarCollapsed());
  };

  const openMobileMenu = () => {
    setMobileOpenPath(pathname);
    setMobileOpen(true);
  };

  const connectionLabel = {
    connecting: "Connecting…",
    live: "Live",
    offline: "Offline",
    reconnecting: "Reconnecting…",
  }[connectionState];

  const isLive = connectionState === "live";
  const desktopWidth = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;
  const desktopMode: SidebarPresentation = collapsed ? "collapsed" : "expanded";

  return (
    <div
      className={cn(
        "dashboard-bg flex",
        contentWidth === "full" ? "h-dvh overflow-hidden" : "min-h-dvh"
      )}
    >
      {/* Desktop sidebar */}
      {sidebar && (
        <aside
          className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out md:flex"
          style={{
            width: desktopWidth,
            paddingTop: "env(safe-area-inset-top)",
          }}
          suppressHydrationWarning
        >
          <SidebarChrome
            mode={desktopMode}
            sidebar={sidebar}
            connectionState={connectionState}
            connectionLabel={connectionLabel}
            isLive={isLive}
            pathname={pathname}
            emailUnread={emailUnread}
            onRefresh={onRefresh}
            onSignOut={handleSignOut}
            onToggleCollapse={toggleCollapsed}
          />
        </aside>
      )}

      {/* Mobile drawer */}
      {sidebar && (
        <Sheet
          open={drawerOpen}
          onOpenChange={(open) => {
            setMobileOpen(open);
            if (open) setMobileOpenPath(pathname);
          }}
        >
          <SheetContent
            side="left"
            className="flex h-full w-[min(100%,280px)] flex-col gap-0 overflow-hidden bg-sidebar p-0 sm:max-w-[280px]"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>
                App sections and site filters
              </SheetDescription>
            </SheetHeader>
            <SidebarChrome
              mode="drawer"
              sidebar={sidebar}
              connectionState={connectionState}
              connectionLabel={connectionLabel}
              isLive={isLive}
              pathname={pathname}
              emailUnread={emailUnread}
              onRefresh={onRefresh}
              onSignOut={handleSignOut}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          sidebar &&
            "md:pl-[var(--bb-sidebar-pad)] motion-safe:transition-[padding] motion-safe:duration-200 motion-safe:ease-out"
        )}
        style={
          sidebar
            ? ({
                ["--bb-sidebar-pad" as string]: `${desktopWidth}px`,
              } as React.CSSProperties)
            : undefined
        }
        suppressHydrationWarning
      >
        {/* Mobile header */}
        {!hideMobileHeader && (
          <header
            className="chrome-surface sticky top-0 z-20 border-b border-border md:hidden"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex h-14 items-center gap-2 px-3">
              {sidebar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={openMobileMenu}
                  aria-label="Open menu"
                  title="Open menu"
                >
                  <List size={20} />
                </Button>
              )}
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
                    className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground"
                  >
                    {isLive ? (
                      <WifiHigh
                        size={11}
                        weight="duotone"
                        className="text-emerald-600"
                      />
                    ) : (
                      <WifiSlash
                        size={11}
                        weight="duotone"
                        className="text-amber-600"
                      />
                    )}
                    <span className={cn(isLive && "text-emerald-600")}>
                      {connectionLabel}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Desktop top bar (when no sidebar context) */}
        {!sidebar && (
          <header
            className="chrome-surface sticky top-0 z-20 hidden border-b border-border md:flex"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex h-14 w-full items-center justify-between px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Broom size={20} weight="duotone" />
                </div>
                <span className="text-sm font-bold">Booking Broom</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleSignOut}
              >
                <SignOut size={18} className="size-[18px]" />
                Sign out
              </Button>
            </div>
          </header>
        )}

        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            contentWidth === "full"
              ? "px-0 py-0 md:px-0 md:py-0"
              : "px-4 py-4 md:px-6 md:py-6 lg:px-8",
            hideMobileNavPad
              ? "pb-0 md:pb-0"
              : "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6"
          )}
        >
          <div
            className={cn(
              "mx-auto flex min-h-0 w-full flex-1 flex-col",
              contentWidth === "full" ? "max-w-none" : "max-w-6xl"
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      {!hideMobileNav && (
        <nav
          className="chrome-surface fixed inset-x-0 bottom-0 z-30 border-t border-border md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-lg items-stretch overflow-x-auto px-2 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
              const isActive = match(pathname);
              const showBadge = href === "/email" && emailUnread > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex min-h-[52px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold leading-tight tracking-tight transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
                  )}
                  <span className="relative">
                    <Icon size={22} weight={isActive ? "duotone" : "regular"} />
                    {showBadge && (
                      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                        {emailUnread > 99 ? "99+" : emailUnread}
                      </span>
                    )}
                  </span>
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-[52px] min-w-[56px] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold leading-tight tracking-tight text-muted-foreground transition-colors active:text-foreground"
            >
              <SignOut size={22} />
              Sign out
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
