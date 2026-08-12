import React, { memo, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { VirtualList } from "@/components/ui/VirtualList";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import {
  AppText,
  Badge,
  Card,
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/components/ui";
import { BookingDetailSheet } from "@/components/bookings/BookingDetailSheet";
import {
  BOOKING_STATUSES,
  statusTone,
  type BookingRow,
  type BookingStatus,
} from "@/components/bookings/types";
import { formatMoney } from "@/lib/money";

const BookingCard = memo(function BookingCard({
  item,
  onPress,
}: {
  item: BookingRow;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText weight="semibold" size={16} numberOfLines={1}>
            {item.customer_name}
          </AppText>
          <AppText muted size={13} numberOfLines={1}>
            {item.service_type}
            {item.site ? ` · ${item.site.name}` : ""}
          </AppText>
        </View>
        <Badge label={item.status} tone={statusTone(item.status)} />
      </View>
      <View style={styles.cardMeta}>
        <AppText muted size={12}>
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </AppText>
        {item.quote?.estimate != null && !item.quote.internal ? (
          <AppText size={12} weight="medium" style={{ color: colors.primary }}>
            {formatMoney(item.quote.estimate, item.quote.currency || "USD")}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
});

export default function BookingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const bookings = useQuery(api.bookings.list, isAuthenticated ? {} : "skip");
  const sites = useQuery(api.sites.list, isAuthenticated ? {} : "skip");
  const updateStatus = useMutation(api.bookings.updateStatus);
  const updateNotes = useMutation(api.bookings.updateInternalNotes);
  const removeBooking = useMutation(api.bookings.remove);

  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">(
    "all"
  );
  const [siteFilter, setSiteFilter] = useState<string | "all">("all");
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const rows = (bookings ?? []) as BookingRow[];
    return rows.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (siteFilter !== "all" && b.site?.slug !== siteFilter) return false;
      return true;
    });
  }, [bookings, statusFilter, siteFilter]);

  const openDetail = (item: BookingRow) => {
    setSelected(item);
    setNotesDraft(item.internal_notes ?? "");
    setSheetVisible(true);
  };

  const requestCloseDetail = () => {
    setSheetVisible(false);
    if (Platform.OS === "android") {
      setSelected(null);
    }
  };

  const onDetailDismiss = () => {
    setSelected(null);
  };

  if (bookings === undefined) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {(["all", ...BOOKING_STATUSES] as const).map((s) => {
            const active = statusFilter === s;
            return (
              <Pressable
                key={s}
                onPress={() => setStatusFilter(s)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText
                  size={12}
                  weight="semibold"
                  style={{
                    color: active
                      ? colors.primaryForeground
                      : colors.foreground,
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() => setSiteFilter("all")}
            style={[
              styles.chip,
              {
                backgroundColor:
                  siteFilter === "all" ? colors.primary : colors.muted,
              },
            ]}
          >
            <AppText
              size={12}
              weight="semibold"
              style={{
                color:
                  siteFilter === "all"
                    ? colors.primaryForeground
                    : colors.foreground,
              }}
            >
              All sites
            </AppText>
          </Pressable>
          {(sites ?? []).map((site: { slug: string; name: string }) => {
            const active = siteFilter === site.slug;
            return (
              <Pressable
                key={site.slug}
                onPress={() => setSiteFilter(site.slug)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                  },
                ]}
              >
                <AppText
                  size={12}
                  weight="semibold"
                  style={{
                    color: active
                      ? colors.primaryForeground
                      : colors.foreground,
                  }}
                >
                  {site.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          title="No bookings"
          subtitle="New leads from your cleaning sites appear here in real time."
        />
      ) : (
        <VirtualList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + 100,
          }}
          renderItem={({ item }) => (
            <BookingCard item={item} onPress={() => openDetail(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}

      <Modal
        visible={sheetVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={requestCloseDetail}
        onDismiss={onDetailDismiss}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {selected ? (
            <BookingDetailSheet
              booking={selected}
              notesDraft={notesDraft}
              onNotesDraftChange={setNotesDraft}
              saving={saving}
              bottomInset={insets.bottom}
              onClose={requestCloseDetail}
              onStatusChange={async (status) => {
                setSaving(true);
                try {
                  await updateStatus({
                    bookingId: selected.id,
                    status,
                  });
                  setSelected({ ...selected, status });
                } finally {
                  setSaving(false);
                }
              }}
              onSaveNotes={async () => {
                setSaving(true);
                try {
                  await updateNotes({
                    bookingId: selected.id,
                    notes: notesDraft,
                  });
                  setSelected({
                    ...selected,
                    internal_notes: notesDraft,
                  });
                } finally {
                  setSaving(false);
                }
              }}
              onDelete={async () => {
                await removeBooking({ bookingId: selected.id });
                requestCloseDetail();
              }}
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingVertical: spacing.sm },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { gap: spacing.sm },
  cardTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
