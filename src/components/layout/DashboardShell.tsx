"use client";

import { AppShell } from "@/components/layout/AppShell";
import {
  ShellChromeProvider,
  useShellChrome,
} from "@/components/layout/ShellChromeContext";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { options } = useShellChrome();

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
      {children}
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
