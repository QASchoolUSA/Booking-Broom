"use client";

import { memo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ShellChromeProvider,
  useShellChromeOptions,
} from "@/components/layout/ShellChromeContext";

/**
 * Keep page content from re-rendering when shell chrome options update.
 * Without this, useShellPage → setOptions → AppShell re-render → page re-render
 * → new sidebar element → setOptions again (infinite loop, frozen nav).
 */
const MemoizedPage = memo(function MemoizedPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
});

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const options = useShellChromeOptions();

  return (
    <AppShell
      sidebar={options.sidebar}
      pageTitle={options.pageTitle}
      contentWidth={options.contentWidth}
      hideMobileNavPad={options.hideMobileNavPad}
      hideMobileNav={options.hideMobileNav}
      hideMobileHeader={options.hideMobileHeader}
      connectionState={options.connectionState ?? "connecting"}
      onRefresh={options.onRefresh}
    >
      <MemoizedPage>{children}</MemoizedPage>
    </AppShell>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellChromeProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </ShellChromeProvider>
  );
}
