"use client";

import { useEffect, useState } from "react";

/**
 * Pins mobile chat to the visual viewport (WhatsApp/Telegram mobile-web pattern).
 * While enabled, sets CSS vars on <html>:
 *   --vv-top  = visualViewport.offsetTop
 *   --vvh     = visualViewport.height
 *   --vvs     = 0px when keyboard-shrunk, else safe-area inset
 * Also locks body (position:fixed) and snaps window.scrollY back to 0.
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
      const offsetTop = vv?.offsetTop ?? 0;
      const keyboardOpen = Math.max(0, window.innerHeight - height) > 80;

      root.style.setProperty("--vv-top", `${offsetTop}px`);
      root.style.setProperty("--vvh", `${height}px`);
      root.style.setProperty(
        "--vvs",
        keyboardOpen ? "0px" : "env(safe-area-inset-bottom, 0px)"
      );

      // Undo iOS auto-pan that scrolls the layout viewport.
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
      root.classList.remove("chat-keyboard-lock");
      root.style.removeProperty("--vv-top");
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
