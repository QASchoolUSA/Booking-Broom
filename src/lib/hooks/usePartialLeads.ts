"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import type { PartialLeadWithSite, Site } from "@/lib/types";
import { useConnectionState } from "@/lib/hooks/useConnectionState";

export function usePartialLeads(siteSlug?: string) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const connectionState = useConnectionState();
  const leadsRaw = useQuery(
    api.partialLeads.list,
    isAuthenticated
      ? siteSlug
        ? { siteSlug }
        : {}
      : "skip"
  );
  const sitesRaw = useQuery(api.sites.list, isAuthenticated ? {} : "skip");

  const loading =
    authLoading ||
    (isAuthenticated && (leadsRaw === undefined || sitesRaw === undefined));

  const leads = (leadsRaw ?? []) as PartialLeadWithSite[];
  const sites = (sitesRaw ?? []) as Site[];

  return {
    leads,
    sites,
    loading,
    connectionState,
    refresh: async () => {},
  };
}
