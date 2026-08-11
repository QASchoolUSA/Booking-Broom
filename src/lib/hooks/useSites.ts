"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import type { Site } from "@/lib/types";
import { useConnectionState } from "@/lib/hooks/useConnectionState";

/**
 * Site list + connection state without loading bookings.
 */
export function useSites() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const connectionState = useConnectionState();
  const authReady = !authLoading && isAuthenticated;

  const sitesRaw = useQuery(api.sites.list, authReady ? {} : "skip");
  const sites = (sitesRaw ?? []) as Site[];
  const loading = authReady && sitesRaw === undefined;

  return {
    sites,
    loading,
    connectionState,
  };
}
