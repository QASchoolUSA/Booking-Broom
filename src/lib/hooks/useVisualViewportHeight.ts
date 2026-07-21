"use client";

import { useEffect, useState } from "react";

export type VisualViewportState = {
  height: number;
  offsetTop: number;
  /** True when the visual viewport is meaningfully shorter than the layout viewport. */
  keyboardOpen: boolean;
};

/**
 * Tracks window.visualViewport for mobile keyboard-aware layouts.
 * Returns null when disabled, on desktop, or if the API is unavailable.
 */
export function useVisualViewportHeight(
  enabled: boolean
): VisualViewportState | null {
  const [state, setState] = useState<VisualViewportState | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setState(null);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) {
      setState(null);
      return;
    }

    const update = () => {
      const height = vv.height;
      const offsetTop = vv.offsetTop;
      const keyboardOpen = Math.max(0, window.innerHeight - height) > 80;
      setState({ height, offsetTop, keyboardOpen });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return state;
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
