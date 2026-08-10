"use client";

import { createContext, useContext } from "react";

export type SidebarPresentation = "expanded" | "collapsed" | "drawer";

interface SidebarLayoutValue {
  /** Icon-rail mode: hide labels and dense chrome. */
  compact: boolean;
  presentation: SidebarPresentation;
}

const SidebarLayoutContext = createContext<SidebarLayoutValue>({
  compact: false,
  presentation: "expanded",
});

export function SidebarLayoutProvider({
  value,
  children,
}: {
  value: SidebarLayoutValue;
  children: React.ReactNode;
}) {
  return (
    <SidebarLayoutContext.Provider value={value}>
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarLayout() {
  return useContext(SidebarLayoutContext);
}
