import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { format, parseISO, isValid } from "date-fns";
import {
  Bed,
  Calendar,
  DollarSign,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Sparkles,
  Users,
  Bath,
  RefreshCw,
  Plus,
} from "lucide-react-native";
import {
  AppText,
  Badge,
  Button,
  Card,
  TextField,
} from "@/components/ui";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import { formatUsPhone } from "@/lib/phone";
import { formatBedrooms, formatMoney } from "@/lib/money";
import {
  BOOKING_STATUSES,
  hasPropertyContent,
  hasQuoteContent,
  statusTone,
  type BookingRow,
  type BookingStatus,
} from "@/components/bookings/types";

type Props = {
  booking: BookingRow;
  notesDraft: string;
  onNotesDraftChange: (value: string) => void;
  saving: boolean;
  onStatusChange: (status: BookingStatus) => Promise<void>;
  onSaveNotes: () => Promise<void>;
  onArchive: () => Promise<void>;
  onUnarchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  bottomInset: number;
};

function formatPreferredDate(raw: string | null) {
  if (!raw) return null;
  try {
    const d = parseISO(raw.length <= 10 ? `${raw}T12:00:00` : raw);
    if (!isValid(d)) return raw;
    return format(d, "EEEE, MMM d, yyyy");
  } catch {
    return raw;
  }
}

function SectionLabel({ children }: { children: string }) {
  return (
    <AppText muted size={11} weight="semibold" style={styles.sectionLabel}>
      {children}
    </AppText>
  );
}

function ContactRow({
  icon: Icon,
  label,
  children,
  onPress,
  onLongPress,
  trailing,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.contactRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.contactIcon, { backgroundColor: colors.muted }]}>
        <Icon size={16} color={colors.mutedForeground} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText muted size={11} weight="medium">
          {label}
        </AppText>
        {children}
      </View>
      {trailing}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} hitSlop={4}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function BookingDetailSheet({
  booking,
  notesDraft,
  onNotesDraftChange,
  saving,
  onStatusChange,
  onSaveNotes,
  onArchive,
  onUnarchive,
  onDelete,
  bottomInset,
}: Props) {
  const isArchived = Boolean(booking.archived_at);
  const { colors } = useTheme();
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    if (!phoneCopied) return;
    const t = setTimeout(() => setPhoneCopied(false), 1600);
    return () => clearTimeout(t);
  }, [phoneCopied]);

  useEffect(() => {
    if (!emailCopied) return;
    const t = setTimeout(() => setEmailCopied(false), 1600);
    return () => clearTimeout(t);
  }, [emailCopied]);

  const property = booking.property ?? null;
  const quote = booking.quote ?? null;
  const currency = quote?.currency || "USD";

  const copyPhone = async () => {
    if (!booking.phone) return;
    await Clipboard.setStringAsync(booking.phone);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhoneCopied(true);
  };

  const openEmail = () => {
    if (!booking.email) return;
    void Linking.openURL(`mailto:${booking.email}`);
  };

  const copyEmail = async () => {
    if (!booking.email) return;
    await Clipboard.setStringAsync(booking.email);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmailCopied(true);
  };

  const preferredDate = formatPreferredDate(booking.preferred_date);
  const preferredTime = booking.preferred_time
    ? booking.preferred_time.charAt(0).toUpperCase() +
      booking.preferred_time.slice(1)
    : null;

  const hasContact =
    Boolean(booking.phone) ||
    Boolean(booking.email) ||
    Boolean(booking.address) ||
    Boolean(preferredDate || preferredTime);

  const propertyTiles = hasPropertyContent(property)
    ? (
        [
          property.bedrooms !== null && {
            key: "beds",
            Icon: Bed,
            value: formatBedrooms(property.bedrooms),
            label: property.bedrooms === 1 ? "Bedroom" : "Bedrooms",
          },
          property.bathrooms !== null && {
            key: "baths",
            Icon: Bath,
            value: String(property.bathrooms),
            label: property.bathrooms === 1 ? "Bathroom" : "Bathrooms",
          },
          property.square_feet !== null && {
            key: "sqft",
            Icon: Ruler,
            value: property.square_feet.toLocaleString("en-US"),
            label: "Sq ft",
          },
          property.occupants !== null && {
            key: "people",
            Icon: Users,
            value: String(property.occupants),
            label: property.occupants === 1 ? "Person" : "People",
          },
        ] as const
      ).filter(Boolean)
    : [];

  const hasRange =
    quote?.estimate_low !== null &&
    quote?.estimate_low !== undefined &&
    quote?.estimate_high !== null &&
    quote?.estimate_high !== undefined;
  const total =
    quote?.estimate != null
      ? formatMoney(quote.estimate, currency)
      : hasRange
        ? `${formatMoney(quote!.estimate_low!, currency)}–${formatMoney(quote!.estimate_high!, currency)}`
        : null;
  const recurring = quote?.recurring_estimate ?? null;
  const headline =
    total ?? (recurring !== null ? formatMoney(recurring, currency) : null);
  const headlineLabel = total
    ? recurring !== null
      ? "Initial clean"
      : "Estimated total"
    : "Per visit";

  const pricedAddOns = (quote?.add_ons ?? []).filter((a) => a.price != null);
  const addOnsTotal =
    pricedAddOns.length > 0
      ? pricedAddOns.reduce((sum, a) => {
          const qty = a.quantity != null && a.quantity > 0 ? a.quantity : 1;
          return sum + (a.price ?? 0) * qty;
        }, 0)
      : null;

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.background,
          paddingBottom: bottomInset + spacing.lg,
        },
      ]}
    >
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <AppText weight="bold" size={20} numberOfLines={2}>
            {booking.customer_name}
          </AppText>
          <View style={styles.headerMeta}>
            <Badge label={booking.status} tone={statusTone(booking.status)} />
            <AppText muted size={13} numberOfLines={1} style={{ flex: 1 }}>
              {booking.site?.name ?? "Site"} · {booking.service_type}
            </AppText>
          </View>
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={spacing.xxl + spacing.xl}
      >
        {hasContact ? (
          <View
            style={[
              styles.group,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {booking.phone ? (
              <ContactRow
                icon={Phone}
                label="Phone"
                onPress={copyPhone}
                trailing={
                  phoneCopied ? (
                    <AppText muted size={11} weight="medium">
                      Copied
                    </AppText>
                  ) : null
                }
              >
                <AppText
                  weight="medium"
                  size={15}
                  style={{ color: colors.primary, marginTop: 2 }}
                >
                  {formatUsPhone(booking.phone)}
                </AppText>
              </ContactRow>
            ) : null}
            {booking.email ? (
              <ContactRow
                icon={Mail}
                label="Email"
                onPress={openEmail}
                onLongPress={copyEmail}
                trailing={
                  emailCopied ? (
                    <AppText muted size={11} weight="medium">
                      Copied
                    </AppText>
                  ) : null
                }
              >
                <AppText
                  weight="medium"
                  size={14}
                  numberOfLines={2}
                  style={{ color: colors.primary, marginTop: 2 }}
                >
                  {booking.email}
                </AppText>
              </ContactRow>
            ) : null}
            {booking.address ? (
              <ContactRow icon={MapPin} label="Address">
                <AppText size={14} style={{ marginTop: 2 }}>
                  {booking.address}
                </AppText>
              </ContactRow>
            ) : null}
            {(preferredDate || preferredTime) && (
              <ContactRow icon={Calendar} label="Preferred date">
                <AppText size={14} style={{ marginTop: 2 }}>
                  {[preferredDate, preferredTime].filter(Boolean).join(" · ")}
                </AppText>
              </ContactRow>
            )}
          </View>
        ) : null}

        {hasPropertyContent(property) ? (
          <View style={styles.block}>
            <SectionLabel>Property</SectionLabel>
            {propertyTiles.length > 0 ? (
              <View style={styles.tileGrid}>
                {propertyTiles.map((tile) => {
                  if (!tile) return null;
                  const Icon = tile.Icon;
                  return (
                    <View
                      key={tile.key}
                      style={[
                        styles.tile,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Icon size={18} color={colors.mutedForeground} />
                      <AppText weight="semibold" size={16} style={styles.tileValue}>
                        {tile.value}
                      </AppText>
                      <AppText muted size={11} weight="medium">
                        {tile.label}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {property.home_type ||
            (propertyTiles.length === 0 && property.size_label) ? (
              <AppText muted size={12} style={{ marginTop: spacing.sm }}>
                {[
                  property.home_type,
                  propertyTiles.length === 0 ? property.size_label : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
            ) : null}
            {propertyTiles.length > 0 &&
            property.square_feet === null &&
            property.size_label ? (
              <AppText muted size={12} style={{ marginTop: spacing.sm }}>
                {/sq/i.test(property.size_label)
                  ? property.size_label
                  : `Size: ${property.size_label}`}
              </AppText>
            ) : null}
            {(property.condition ||
              property.last_cleaned ||
              (property.excluded_areas?.length ?? 0) > 0) && (
              <View
                style={[
                  styles.group,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                {property.condition ? (
                  <View
                    style={[
                      styles.metaRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <AppText muted size={13}>
                      Condition
                    </AppText>
                    <AppText weight="medium" size={13}>
                      {property.condition}
                    </AppText>
                  </View>
                ) : null}
                {property.last_cleaned ? (
                  <View
                    style={[
                      styles.metaRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <AppText muted size={13}>
                      Last cleaned
                    </AppText>
                    <AppText weight="medium" size={13}>
                      {property.last_cleaned}
                    </AppText>
                  </View>
                ) : null}
                {(property.excluded_areas?.length ?? 0) > 0 ? (
                  <View style={styles.metaBlock}>
                    <AppText muted size={11} weight="semibold" style={styles.sectionLabel}>
                      Excluded
                    </AppText>
                    <View style={styles.pillWrap}>
                      {property.excluded_areas!.map((area) => (
                        <View
                          key={area}
                          style={[
                            styles.pill,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <AppText size={12} weight="medium">
                            {area}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {hasQuoteContent(quote) ? (
          <View
            style={[
              styles.quotePanel,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.quoteAccent, { backgroundColor: colors.primary }]}
            />
            <View style={styles.quoteInner}>
              {headline ? (
                <View
                  style={[
                    styles.estimateHeroBlock,
                    { backgroundColor: colors.primary + "12" },
                  ]}
                >
                  <View style={styles.estimateTopRow}>
                    <View
                      style={[
                        styles.estimateIcon,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <DollarSign size={18} color={colors.primaryForeground} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText
                        size={11}
                        weight="semibold"
                        style={[
                          styles.sectionLabel,
                          { color: colors.primary },
                        ]}
                      >
                        {headlineLabel}
                      </AppText>
                      {quote.internal ? (
                        <AppText muted size={11} style={{ marginTop: 2 }}>
                          Internal — not shown to customer
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                  <AppText
                    weight="bold"
                    size={40}
                    style={[styles.estimateHero, { color: colors.primary }]}
                  >
                    {headline}
                  </AppText>
                  {(hasRange && quote.estimate != null) ||
                  (total && recurring !== null) ? (
                    <View style={styles.estimateMetaRow}>
                      {quote.estimate != null && hasRange ? (
                        <View
                          style={[
                            styles.estimateChip,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.primary + "33",
                            },
                          ]}
                        >
                          <AppText
                            size={12}
                            weight="medium"
                            style={{ color: colors.primary }}
                          >
                            Range {formatMoney(quote.estimate_low!, currency)}–
                            {formatMoney(quote.estimate_high!, currency)}
                          </AppText>
                        </View>
                      ) : null}
                      {total && recurring !== null ? (
                        <View
                          style={[
                            styles.estimateChip,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.primary + "33",
                            },
                          ]}
                        >
                          <AppText
                            size={12}
                            weight="medium"
                            style={{ color: colors.primary }}
                          >
                            Then {formatMoney(recurring, currency)}/visit
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {(quote.service_level || quote.frequency) && (
                <View style={styles.quoteMeta}>
                  {quote.service_level ? (
                    <View style={styles.quoteMetaItem}>
                      <View style={styles.metaLabel}>
                        <Sparkles size={14} color={colors.mutedForeground} />
                        <AppText muted size={12}>
                          Level
                        </AppText>
                      </View>
                      <View
                        style={[
                          styles.levelPill,
                          {
                            backgroundColor: colors.primary + "14",
                            borderColor: colors.primary + "40",
                          },
                        ]}
                      >
                        <AppText
                          size={12}
                          weight="semibold"
                          style={{ color: colors.primary }}
                        >
                          {quote.service_level}
                        </AppText>
                      </View>
                    </View>
                  ) : null}
                  {quote.frequency ? (
                    <View style={styles.quoteMetaItem}>
                      <View style={styles.metaLabel}>
                        <RefreshCw size={14} color={colors.mutedForeground} />
                        <AppText muted size={12}>
                          Frequency
                        </AppText>
                      </View>
                      <AppText weight="semibold" size={13}>
                        {quote.frequency}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              )}

              {(quote.add_ons?.length ?? 0) > 0 ? (
                <View style={styles.addOnsSection}>
                  <View style={styles.addOnsHeader}>
                    <View style={styles.metaLabel}>
                      <View
                        style={[
                          styles.addOnsIcon,
                          { backgroundColor: colors.accent + "18" },
                        ]}
                      >
                        <Plus size={14} color={colors.accent} />
                      </View>
                      <AppText weight="semibold" size={14}>
                        Add-ons
                      </AppText>
                      <AppText muted size={12}>
                        ({quote.add_ons!.length})
                      </AppText>
                    </View>
                    {addOnsTotal != null ? (
                      <AppText
                        size={14}
                        weight="bold"
                        style={{ color: colors.accent }}
                      >
                        +{formatMoney(addOnsTotal, currency)}
                      </AppText>
                    ) : null}
                  </View>
                  <View style={styles.addOnList}>
                    {quote.add_ons!.map((addOn, index) => {
                      const linePrice =
                        addOn.price != null
                          ? addOn.price *
                            (addOn.quantity != null && addOn.quantity > 0
                              ? addOn.quantity
                              : 1)
                          : null;
                      return (
                        <View
                          key={`${addOn.label}-${index}`}
                          style={[
                            styles.addOnCard,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.addOnAccent,
                              { backgroundColor: colors.accent },
                            ]}
                          />
                          <View style={styles.addOnCardBody}>
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <AppText
                                weight="semibold"
                                size={14}
                                numberOfLines={2}
                              >
                                {addOn.label}
                              </AppText>
                              {addOn.quantity != null && addOn.quantity > 1 ? (
                                <AppText muted size={12}>
                                  Qty {addOn.quantity}
                                  {addOn.price != null
                                    ? ` · ${formatMoney(addOn.price, currency)} each`
                                    : ""}
                                </AppText>
                              ) : null}
                            </View>
                            <View
                              style={[
                                styles.addOnPriceChip,
                                {
                                  backgroundColor:
                                    linePrice != null
                                      ? colors.accent + "18"
                                      : colors.muted,
                                },
                              ]}
                            >
                              <AppText
                                weight="bold"
                                size={13}
                                style={{
                                  color:
                                    linePrice != null
                                      ? colors.accent
                                      : colors.mutedForeground,
                                  fontVariant: ["tabular-nums"],
                                }}
                              >
                                {linePrice != null
                                  ? `+${formatMoney(linePrice, currency)}`
                                  : "Included"}
                              </AppText>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {booking.notes ? (
          <Card>
            <AppText weight="medium" size={13} muted>
              Customer notes
            </AppText>
            <AppText style={{ marginTop: 6 }}>{booking.notes}</AppText>
          </Card>
        ) : null}

        <View style={styles.block}>
          <SectionLabel>Status</SectionLabel>
          <View style={styles.statusPills}>
            {BOOKING_STATUSES.map((s) => {
              const active = booking.status === s;
              return (
                <Pressable
                  key={s}
                  disabled={saving}
                  onPress={() => void onStatusChange(s)}
                  style={[
                    styles.statusPill,
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
          </View>
        </View>

        <TextField
          label="Internal notes"
          value={notesDraft}
          onChangeText={onNotesDraftChange}
          multiline
        />
        <Button label="Save notes" loading={saving} onPress={onSaveNotes} />
        {isArchived ? (
          <>
            <Button
              label="Unarchive"
              variant="secondary"
              loading={saving}
              onPress={onUnarchive}
            />
            <Button
              label="Delete permanently"
              variant="destructive"
              loading={saving}
              onPress={() => {
                Alert.alert(
                  "Delete permanently?",
                  "This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        void onDelete();
                      },
                    },
                  ]
                );
              }}
            />
          </>
        ) : (
          <Button
            label="Archive booking"
            variant="secondary"
            loading={saving}
            onPress={onArchive}
          />
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  block: { gap: spacing.sm },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tile: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  tileValue: {
    fontVariant: ["tabular-nums"],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaBlock: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quotePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    overflow: "hidden",
    flexDirection: "row",
  },
  quoteAccent: {
    width: 4,
  },
  quoteInner: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    gap: spacing.md,
  },
  estimateHeroBlock: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  estimateTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  estimateIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  estimateHero: {
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
    lineHeight: 46,
  },
  estimateMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  estimateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quoteMeta: {
    gap: spacing.sm,
  },
  quoteMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  addOnsSection: {
    gap: spacing.sm,
  },
  addOnsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  addOnsIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  addOnList: {
    gap: spacing.sm,
  },
  addOnCard: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  addOnAccent: {
    width: 3,
  },
  addOnCardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  addOnPriceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statusPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
