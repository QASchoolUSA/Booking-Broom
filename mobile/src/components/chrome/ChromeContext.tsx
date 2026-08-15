import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

/** Show the tab bar as soon as a nested stack pop starts; hide on push. */
export function useNestedStackTabBarListeners() {
  const { setHideTabBar } = useChrome();

  return useCallback(
    ({ navigation }: { navigation: { getState: () => { index?: number } } }) => ({
      transitionStart: (e: { data: { closing: boolean } }) => {
        setHideTabBar(!e.data.closing);
      },
      transitionEnd: () => {
        setHideTabBar((navigation.getState()?.index ?? 0) > 0);
      },
    }),
    [setHideTabBar]
  );
}
