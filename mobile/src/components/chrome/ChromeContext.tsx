import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ChromeContextValue = {
  hideTabBar: boolean;
  setHideTabBar: (hide: boolean) => void;
};

const ChromeContext = createContext<ChromeContextValue | null>(null);

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [hideTabBar, setHideTabBar] = useState(false);
  const value = useMemo(
    () => ({ hideTabBar, setHideTabBar }),
    [hideTabBar]
  );
  return (
    <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
  );
}

export function useChrome() {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error("useChrome must be used within ChromeProvider");
  return ctx;
}
