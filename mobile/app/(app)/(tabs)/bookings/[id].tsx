import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookingDetailSheet } from "@/components/bookings/BookingDetailSheet";
import type { BookingRow } from "@/components/bookings/types";
import { LoadingBlock, Screen, EmptyState } from "@/components/ui";
import { api, type Id } from "@/lib/api";
import { useTheme } from "@/theme";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();

  const booking = useQuery(
    api.bookings.get,
    isAuthenticated && id
      ? { bookingId: id as Id<"bookings"> }
      : "skip"
  ) as BookingRow | null | undefined;

  const updateStatus = useMutation(api.bookings.updateStatus);
  const updateNotes = useMutation(api.bookings.updateInternalNotes);
  const archiveBooking = useMutation(api.bookings.archive);
  const unarchiveBooking = useMutation(api.bookings.unarchive);
  const removeBooking = useMutation(api.bookings.remove);

  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (booking) setNotesDraft(booking.internal_notes ?? "");
  }, [booking?.id, booking?.internal_notes]);

  if (booking === undefined) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen>
        <EmptyState title="Booking not found" />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: booking.customer_name }} />
      <BookingDetailSheet
        booking={booking}
        notesDraft={notesDraft}
        onNotesDraftChange={setNotesDraft}
        saving={saving}
        bottomInset={insets.bottom}
        onStatusChange={async (status) => {
          setSaving(true);
          try {
            await updateStatus({
              bookingId: booking.id as Id<"bookings">,
              status,
            });
          } finally {
            setSaving(false);
          }
        }}
        onSaveNotes={async () => {
          setSaving(true);
          try {
            await updateNotes({
              bookingId: booking.id as Id<"bookings">,
              notes: notesDraft,
            });
          } finally {
            setSaving(false);
          }
        }}
        onArchive={async () => {
          setSaving(true);
          try {
            await archiveBooking({
              bookingId: booking.id as Id<"bookings">,
            });
            router.back();
          } finally {
            setSaving(false);
          }
        }}
        onUnarchive={async () => {
          setSaving(true);
          try {
            await unarchiveBooking({
              bookingId: booking.id as Id<"bookings">,
            });
            router.back();
          } finally {
            setSaving(false);
          }
        }}
        onDelete={async () => {
          setSaving(true);
          try {
            await removeBooking({
              bookingId: booking.id as Id<"bookings">,
            });
            router.back();
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}
