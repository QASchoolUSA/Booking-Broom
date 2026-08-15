import React, { memo, useLayoutEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useNavigation, useRouter, type Href } from "expo-router";
import { ListFilter } from "lucide-react-native";
import { VirtualList } from "@/components/ui/VirtualList";
import { useConvexAuth, useQuery } from "convex/react";
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

export default function BookingsIndexScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { isAuthenticated } = useConvexAuth();
  const [listMode, setListMode] = useState<"active" | "archived">("active");

  const openListFilter = () => {
    const apply = (mode: "active" | "archived") => setListMode(mode);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Active bookings", "Archived"],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) apply("active");
          if (index === 2) apply("archived");
        }
      );
      return;
    }
    Alert.alert("Filter", undefined, [
      { text: "Active bookings", onPress: () => apply("active") },
      { text: "Archived", onPress: () => apply("archived") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: listMode === "archived" ? "Archived" : "Bookings",
      headerRight: () => (
        <Pressable
          onPress={openListFilter}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Filter bookings"
          style={{ paddingHorizontal: 4 }}
        >
          <View>
            <ListFilter size={22} color={colors.primary} />
            {listMode === "archived" ? (
              <View
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.accent,
                }}
              />
            ) : null}
          </View>
        </Pressable>
      ),
    });
  }, [colors.accent, colors.primary, listMode, navigation]);
  const bookings = useQuery(
    api.bookings.list,
    isAuthenticated
      ? listMode === "archived"
        ? { includeArchived: true }
        : {}
      : "skip"
  );
  const sites = useQuery(api.sites.list, isAuthenticated ? {} : "skip");

  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">(
    "all"
  );
  const [siteFilter, setSiteFilter] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    const rows = (bookings ?? []) as BookingRow[];
    return rows.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (siteFilter !== "all" && b.site?.slug !== siteFilter) return false;
      return true;
    });
  }, [bookings, statusFilter, siteFilter]);

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
          title={listMode === "archived" ? "No archived bookings" : "No bookings"}
          subtitle={
            listMode === "archived"
              ? "Archived bookings will show up here."
              : "New leads from your cleaning sites appear here in real time."
          }
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
            <BookingCard
              item={item}
              onPress={() =>
                router.push(`/bookings/${item.id}` as Href)
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
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
