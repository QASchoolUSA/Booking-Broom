"use client";

import { useEffect, useState } from "react";

/**
 * Mirrors visualViewport into CSS vars for ios-chat-style mobile layouts.
 * While enabled:
 *   --vvh = visualViewport.height
 *   --vvs = 0px when keyboard-shrunk, else env(safe-area-inset-bottom)
 * Also toggles `chat-keyboard-lock` on <html> to prevent document pan.
 */
export function useChatVisualViewport(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    const vv = window.visualViewport;

    root.classList.add("chat-keyboard-lock");

    const sync = () => {
      const height = vv?.height ?? window.innerHeight;
      const keyboardOpen =
        Math.max(0, window.innerHeight - height) > 80;
      root.style.setProperty("--vvh", `${height}px`);
      root.style.setProperty(
        "--vvs",
        keyboardOpen ? "0px" : "env(safe-area-inset-bottom, 0px)"
      );
    };

    sync();
    vv?.addEventListener("resize", sync);
    window.addEventListener("resize", sync);

    return () => {
      vv?.removeEventListener("resize", sync);
      window.removeEventListener("resize", sync);
      root.classList.remove("chat-keyboard-lock");
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvs");
    };
  }, [enabled]);
}

/** True below the app `md` breakpoint (768px). */
export function useIsMobileMd(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
