"use client";

import { useEffect, useState } from "react";
import { useConvex, useConvexAuth } from "convex/react";
import type { ConnectionState as ShellConnectionState } from "@/components/layout/ShellChromeContext";

/**
 * Live/offline status without fetching bookings or sites.
 */
export function useConnectionState(): ShellConnectionState {
  const convex = useConvex();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [wsConnected, setWsConnected] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);

  useEffect(() => {
    const initial = convex.connectionState();
    setWsConnected(initial.isWebSocketConnected);
    setHasEverConnected(initial.hasEverConnected);
    return convex.subscribeToConnectionState((state) => {
      setWsConnected(state.isWebSocketConnected);
      setHasEverConnected(state.hasEverConnected);
    });
  }, [convex]);

  if (authLoading) return "connecting";
  if (!isAuthenticated) return "offline";
  if (wsConnected) return "live";
  if (hasEverConnected) return "reconnecting";
  return "connecting";
}
