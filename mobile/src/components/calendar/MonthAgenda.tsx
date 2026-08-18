import React, { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { addMonths, format } from "date-fns";
import { Bell, ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "@/components/ui";
import { VirtualList } from "@/components/ui/VirtualList";
import {
  eventsForDay,
  formatEventTime,
  inMonth,
  isToday,
  monthCells,
  type MobileCalendarEvent,
} from "@/lib/calendar-utils";

type Props = {
  cursor: Date;
  selectedDay: Date;
  events: MobileCalendarEvent[];
  onCursorChange: (d: Date) => void;
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: MobileCalendarEvent) => void;
  onAddReminder: (day: Date) => void;
  bottomPad: number;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const AgendaRow = memo(function AgendaRow({
  event,
  onPress,
}: {
  event: MobileCalendarEvent;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const isReminder = event.kind === "reminder";
  const isTentative = event.kind === "booking_tentative";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.agendaRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: isReminder ? "#d97706" : event.color,
          borderLeftWidth: 4,
          opacity: pressed || isTentative ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.agendaTop}>
          {isReminder ? (
            <Bell size={14} color="#d97706" />
          ) : null}
          <AppText weight="semibold" size={15} numberOfLines={1} style={{ flex: 1 }}>
            {event.title}
          </AppText>
        </View>
        <AppText muted size={12}>
          {formatEventTime(event)}
          {isTentative ? " · Requested" : ""}
          {event.site ? ` · ${event.site.name}` : ""}
        </AppText>
        {event.subtitle ? (
          <AppText muted size={12} numberOfLines={1}>
            {event.subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
});

export function MonthAgenda({
  cursor,
  selectedDay,
  events,
  onCursorChange,
  onSelectDay,
  onSelectEvent,
  onAddReminder,
  bottomPad,
}: Props) {
  const { colors } = useTheme();
  const cells = useMemo(() => monthCells(cursor), [cursor]);
  const dayEvents = useMemo(
    () => eventsForDay(events, selectedDay),
    [events, selectedDay]
  );

  const dotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const ev of events) {
      const key = format(new Date(ev.start_at_ms), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      if (list.length < 3) list.push(ev.color);
      map.set(key, list);
    }
    return map;
  }, [events]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => onCursorChange(addMonths(cursor, -1))}
          hitSlop={12}
          accessibilityLabel="Previous month"
          style={styles.navBtn}
        >
          <ChevronLeft size={22} color={colors.primary} />
        </Pressable>
        <AppText weight="bold" size={17}>
          {format(cursor, "MMMM yyyy")}
        </AppText>
        <Pressable
          onPress={() => onCursorChange(addMonths(cursor, 1))}
          hitSlop={12}
          accessibilityLabel="Next month"
          style={styles.navBtn}
        >
          <ChevronRight size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <AppText
            key={`${d}-${i}`}
            muted
            size={11}
            weight="semibold"
            style={styles.weekLabel}
          >
            {d}
          </AppText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const outside = !inMonth(day, cursor);
          const today = isToday(day);
          const selected = isSameDaySafe(day, selectedDay);
          const dots = dotsByDay.get(key) ?? [];
          return (
            <Pressable
              key={key}
              onPress={() => onSelectDay(day)}
              onLongPress={() => onAddReminder(day)}
              accessibilityRole="button"
              accessibilityLabel={format(day, "EEEE MMMM d")}
              style={styles.cell}
            >
              <View
                style={[
                  styles.dayCircle,
                  today && { borderColor: colors.primary, borderWidth: 2 },
                  selected && {
                    backgroundColor: colors.primary,
                  },
                ]}
              >
                <AppText
                  size={14}
                  weight={today || selected ? "bold" : "medium"}
                  style={{
                    color: selected
                      ? colors.primaryForeground
                      : outside
                        ? colors.mutedForeground
                        : colors.foreground,
                    opacity: outside && !selected ? 0.45 : 1,
                  }}
                >
                  {format(day, "d")}
                </AppText>
              </View>
              <View style={styles.dots}>
                {dots.map((c, idx) => (
                  <View
                    key={`${key}-dot-${idx}`}
                    style={[styles.dot, { backgroundColor: c }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.agendaHeader,
          { borderTopColor: colors.border },
        ]}
      >
        <AppText weight="semibold" size={15}>
          {format(selectedDay, "EEEE, MMM d")}
        </AppText>
        <Pressable
          onPress={() => onAddReminder(selectedDay)}
          hitSlop={10}
          accessibilityLabel="Add reminder"
          style={[
            styles.fabMini,
            { backgroundColor: colors.primary },
          ]}
        >
          <Plus size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {dayEvents.length === 0 ? (
        <View style={styles.empty}>
          <AppText muted size={14}>
            Nothing scheduled
          </AppText>
        </View>
      ) : (
        <VirtualList
          data={dayEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: bottomPad,
            gap: spacing.sm,
          }}
          renderItem={({ item }) => (
            <AgendaRow event={item} onPress={() => onSelectEvent(item)} />
          )}
          ItemSeparatorComponent={() => (
            <View style={{ height: spacing.sm }} />
          )}
        />
      )}
    </View>
  );
}

function isSameDaySafe(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  weekRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.sm,
  },
  cell: {
    width: "14.2857%",
    alignItems: "center",
    paddingVertical: 4,
    minHeight: 48,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 3,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  agendaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  fabMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
  agendaRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  agendaTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
