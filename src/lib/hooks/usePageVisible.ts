"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  if (typeof document === "undefined") return () => undefined;
  const handler = () => onStoreChange();
  document.addEventListener("visibilitychange", handler);
  window.addEventListener("focus", handler);
  window.addEventListener("blur", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("focus", handler);
    window.removeEventListener("blur", handler);
  };
}

function getSnapshot() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function getServerSnapshot() {
  return true;
}

/** True when the browser tab is visible — use to skip heavy Convex useQuery while hidden. */
export function usePageVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
