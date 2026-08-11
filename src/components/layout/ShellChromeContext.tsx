"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ConnectionState =
  | "connecting"
  | "live"
  | "offline"
  | "reconnecting";

export type ShellChromeOptions = {
  sidebar?: ReactNode;
  pageTitle?: string;
  contentWidth?: "default" | "full";
  hideMobileNavPad?: boolean;
  hideMobileNav?: boolean;
  hideMobileHeader?: boolean;
  connectionState?: ConnectionState;
  onRefresh?: () => void;
};

type ShellChromeContextValue = {
  options: ShellChromeOptions;
  setOptions: (options: ShellChromeOptions) => void;
};

const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

export const DEFAULT_SHELL_OPTIONS: ShellChromeOptions = {
  contentWidth: "default",
  hideMobileNavPad: false,
  hideMobileNav: false,
  hideMobileHeader: false,
  connectionState: "connecting",
};

export function ShellChromeProvider({ children }: { children: ReactNode }) {
  const [options, setOptionsState] = useState<ShellChromeOptions>(
    DEFAULT_SHELL_OPTIONS
  );

  const setOptions = useCallback((next: ShellChromeOptions) => {
    setOptionsState(next);
  }, []);

  const value = useMemo(
    () => ({ options, setOptions }),
    [options, setOptions]
  );

  return (
    <ShellChromeContext.Provider value={value}>
      {children}
    </ShellChromeContext.Provider>
  );
}

export function useShellChrome() {
  const ctx = useContext(ShellChromeContext);
  if (!ctx) {
    throw new Error("useShellChrome must be used within ShellChromeProvider");
  }
  return ctx;
}

/**
 * Register page chrome for the persistent AppShell. Clears on unmount.
 */
export function useShellPage(options: ShellChromeOptions) {
  const { setOptions } = useShellChrome();

  useEffect(() => {
    setOptions(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- track chrome fields explicitly
  }, [
    setOptions,
    options.sidebar,
    options.pageTitle,
    options.contentWidth,
    options.hideMobileNavPad,
    options.hideMobileNav,
    options.hideMobileHeader,
    options.connectionState,
    options.onRefresh,
  ]);

  useEffect(() => {
    return () => setOptions(DEFAULT_SHELL_OPTIONS);
  }, [setOptions]);
}
