"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

type ShellChromeSetContextValue = {
  setOptions: (options: ShellChromeOptions) => void;
};

const ShellChromeOptionsContext = createContext<ShellChromeOptions | null>(
  null
);
const ShellChromeSetContext = createContext<ShellChromeSetContextValue | null>(
  null
);

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

  const setValue = useMemo(() => ({ setOptions }), [setOptions]);

  return (
    <ShellChromeSetContext.Provider value={setValue}>
      <ShellChromeOptionsContext.Provider value={options}>
        {children}
      </ShellChromeOptionsContext.Provider>
    </ShellChromeSetContext.Provider>
  );
}

/** Read chrome options — only the shell should subscribe to this. */
export function useShellChromeOptions() {
  const options = useContext(ShellChromeOptionsContext);
  if (!options) {
    throw new Error(
      "useShellChromeOptions must be used within ShellChromeProvider"
    );
  }
  return options;
}

/**
 * Register page chrome for the persistent AppShell.
 * Uses the setter-only context so pages do not re-render when chrome updates
 * (avoids an infinite loop from recreating sidebar elements each render).
 */
export function useShellPage(options: ShellChromeOptions) {
  const ctx = useContext(ShellChromeSetContext);
  if (!ctx) {
    throw new Error("useShellPage must be used within ShellChromeProvider");
  }
  const { setOptions } = ctx;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const {
    pageTitle,
    contentWidth,
    hideMobileNavPad,
    hideMobileNav,
    hideMobileHeader,
    connectionState,
    onRefresh,
    sidebar,
  } = options;

  useEffect(() => {
    setOptions(optionsRef.current);
  }, [
    setOptions,
    pageTitle,
    contentWidth,
    hideMobileNavPad,
    hideMobileNav,
    hideMobileHeader,
    connectionState,
    onRefresh,
    sidebar,
  ]);

  useEffect(() => {
    return () => setOptions(DEFAULT_SHELL_OPTIONS);
  }, [setOptions]);
}
