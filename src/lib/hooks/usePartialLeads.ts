"use client";

import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import type { PartialLeadWithSite, Site } from "@/lib/types";
import { useConnectionState } from "@/lib/hooks/useConnectionState";

export function usePartialLeads(
  siteSlug?: string,
  options?: { mode?: "abandoned" | "recovery" }
) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const connectionState = useConnectionState();
  const mode = options?.mode ?? "abandoned";

  const abandonedRaw = useQuery(
    api.partialLeads.list,
    isAuthenticated && mode === "abandoned"
      ? siteSlug
        ? { siteSlug }
        : {}
      : "skip"
  );
  const recoveryRaw = useQuery(
    api.partialLeads.listRecovery,
    isAuthenticated && mode === "recovery"
      ? siteSlug
        ? { siteSlug, hideJunk: true }
        : { hideJunk: true }
      : "skip"
  );
  const sitesRaw = useQuery(api.sites.list, isAuthenticated ? {} : "skip");
  const enqueueScoring = useMutation(api.partialLeads.enqueueRecoveryScoring);

  const leadsRaw = mode === "recovery" ? recoveryRaw : abandonedRaw;

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
    enqueueRecoveryScoring: async () => {
      await enqueueScoring({});
    },
  };
}
