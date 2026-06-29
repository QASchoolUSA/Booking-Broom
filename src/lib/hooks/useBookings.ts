"use client";

import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import type { BookingStatus, BookingWithSite, Site } from "@/lib/types";
import type { Id } from "convex/_generated/dataModel";

type ConnectionState = "connecting" | "live" | "offline" | "reconnecting";

export function useBookings(siteSlug?: string) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const allBookingsRaw = useQuery(
    api.bookings.list,
    isAuthenticated ? {} : "skip"
  );
  const sitesRaw = useQuery(api.sites.list, isAuthenticated ? {} : "skip");

  const updateStatusMutation = useMutation(api.bookings.updateStatus);
  const updateNotesMutation = useMutation(api.bookings.updateInternalNotes);

  const loading =
    authLoading ||
    (isAuthenticated && (allBookingsRaw === undefined || sitesRaw === undefined));

  const allBookings = (allBookingsRaw ?? []) as BookingWithSite[];
  const sites = (sitesRaw ?? []) as Site[];

  const bookings = siteSlug
    ? allBookings.filter((b) => b.site?.slug === siteSlug)
    : allBookings;

  let connectionState: ConnectionState = "connecting";
  if (!isAuthenticated) {
    connectionState = "offline";
  } else if (loading) {
    connectionState = "connecting";
  } else {
    connectionState = "live";
  }

  const updateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    await updateStatusMutation({
      bookingId: bookingId as Id<"bookings">,
      status,
    });
  };

  const updateInternalNotes = async (bookingId: string, notes: string) => {
    await updateNotesMutation({
      bookingId: bookingId as Id<"bookings">,
      notes,
    });
  };

  const refresh = async () => {
    // Convex useQuery auto-refreshes; no-op kept for AppShell API compatibility
  };

  return {
    bookings,
    allBookings,
    sites,
    loading,
    connectionState,
    error: null as string | null,
    refresh,
    updateBookingStatus,
    updateInternalNotes,
  };
}
