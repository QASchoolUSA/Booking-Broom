import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { Bell, CalendarCheck } from "lucide-react-native";
import { api } from "@/lib/api";
import type { Id } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import { AppText, Button, Card, TextField } from "@/components/ui";
import type { BookingRow } from "@/components/bookings/types";
import { wallTimeToUtcMs } from "@/lib/calendar-utils";

const TZ = "America/New_York";

type ReminderRow = {
  id: string;
  title: string;
  due_at_ms: number;
  status: string;
  offset_minutes: number | null;
};

type Props = {
  booking: BookingRow;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function msToLocalParts(ms: number | null | undefined, fallback = new Date()) {
  const d = ms ? new Date(ms) : fallback;
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

export function ScheduleSection({ booking }: Props) {
  const { colors } = useTheme();
  const schedule = useMutation(api.bookings.schedule);
  const createReminder = useMutation(api.reminders.create);
  const removeReminder = useMutation(api.reminders.remove);
  const reminders = useQuery(api.reminders.listByBooking, {
    bookingId: booking.id,
  }) as ReminderRow[] | undefined;

  const tz = booking.timezone || TZ;
  const initial = msToLocalParts(
    booking.scheduled_start_at_ms,
    booking.preferred_date
      ? new Date(`${booking.preferred_date}T09:00:00`)
      : new Date()
  );
  const initialEnd = msToLocalParts(
    booking.scheduled_end_at_ms,
    new Date(
      (booking.scheduled_start_at_ms ?? Date.now()) + 3 * 60 * 60 * 1000
    )
  );

  const [dateStr, setDateStr] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.time);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [alertDay, setAlertDay] = useState(true);
  const [alertHour, setAlertHour] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const start = msToLocalParts(
      booking.scheduled_start_at_ms,
      booking.preferred_date
        ? new Date(`${booking.preferred_date}T09:00:00`)
        : new Date()
    );
    const end = msToLocalParts(
      booking.scheduled_end_at_ms,
      new Date(
        (booking.scheduled_start_at_ms ?? Date.now()) + 3 * 60 * 60 * 1000
      )
    );
    setDateStr(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
  }, [
    booking.scheduled_start_at_ms,
    booking.scheduled_end_at_ms,
    booking.preferred_date,
  ]);

  const parseSlot = () => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [sh, smin] = startTime.split(":").map(Number);
    const [eh, emin] = endTime.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(sh) || Number.isNaN(smin)) {
      throw new Error("Use date YYYY-MM-DD and time HH:mm");
    }
    const startAt = wallTimeToUtcMs(y, m, d, sh, smin, tz);
    let endAt = wallTimeToUtcMs(
      y,
      m,
      d,
      Number.isNaN(eh) ? sh + 3 : eh,
      Number.isNaN(emin) ? 0 : emin,
      tz
    );
    if (endAt <= startAt) endAt = startAt + 3 * 60 * 60 * 1000;
    return { startAt, endAt };
  };

  const handleSchedule = async (confirm: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const { startAt, endAt } = parseSlot();
      const offsets: number[] = [];
      if (!booking.scheduled_start_at_ms) {
        if (alertDay) offsets.push(1440);
        if (alertHour) offsets.push(60);
      }
      await schedule({
        bookingId: booking.id,
        scheduledStartAt: startAt,
        scheduledEndAt: endAt,
        timezone: tz,
        confirm,
        alertOffsetsMinutes: offsets,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.sectionHead}>
        <CalendarCheck size={16} color={colors.primary} />
        <AppText muted size={11} weight="semibold" style={styles.label}>
          SCHEDULE JOB
        </AppText>
      </View>
      <Card style={{ gap: spacing.sm }}>
        <TextField
          label="Date (YYYY-MM-DD)"
          value={dateStr}
          onChangeText={setDateStr}
          placeholder="2026-08-16"
          autoCapitalize="none"
        />
        <TextField
          label="Start (HH:mm)"
          value={startTime}
          onChangeText={setStartTime}
          placeholder="09:00"
          autoCapitalize="none"
        />
        <TextField
          label="End (HH:mm)"
          value={endTime}
          onChangeText={setEndTime}
          placeholder="12:00"
          autoCapitalize="none"
        />
        <AppText muted size={11}>
          Timezone: {tz}
        </AppText>
        {!booking.scheduled_start_at_ms && (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.row}>
              <AppText size={13}>Alert 1 day before</AppText>
              <Switch value={alertDay} onValueChange={setAlertDay} />
            </View>
            <View style={styles.row}>
              <AppText size={13}>Alert 1 hour before</AppText>
              <Switch value={alertHour} onValueChange={setAlertHour} />
            </View>
          </View>
        )}
        {error ? (
          <AppText size={13} style={{ color: colors.destructive }}>
            {error}
          </AppText>
        ) : null}
        <Button
          label={
            booking.scheduled_start_at_ms
              ? "Update schedule"
              : "Schedule & confirm"
          }
          onPress={() => handleSchedule(true)}
          loading={saving}
        />
        <Button
          label="Save schedule"
          variant="secondary"
          onPress={() => handleSchedule(false)}
          loading={saving}
        />
      </Card>

      <View style={styles.sectionHead}>
        <Bell size={16} color="#d97706" />
        <AppText muted size={11} weight="semibold" style={styles.label}>
          REMINDERS
        </AppText>
      </View>
      <Card style={{ gap: spacing.sm }}>
        {(reminders ?? []).length === 0 ? (
          <AppText muted size={13}>
            No reminders linked yet.
          </AppText>
        ) : (
          (reminders ?? []).map((r) => (
            <View
              key={r.id}
              style={[
                styles.reminderRow,
                { borderColor: colors.border, backgroundColor: colors.muted },
              ]}
            >
              <View style={{ flex: 1 }}>
                <AppText weight="medium" size={14} numberOfLines={1}>
                  {r.title}
                </AppText>
                <AppText muted size={12}>
                  {format(new Date(r.due_at_ms), "MMM d · h:mm a")}
                  {r.status === "sent" ? " · Sent" : ""}
                </AppText>
              </View>
              <Pressable
                onPress={() =>
                  removeReminder({
                    reminderId: r.id as Id<"reminders">,
                  })
                }
                hitSlop={8}
              >
                <AppText size={12} style={{ color: colors.destructive }}>
                  Remove
                </AppText>
              </Pressable>
            </View>
          ))
        )}
        <TextField
          label="Add reminder"
          value={reminderTitle}
          onChangeText={setReminderTitle}
          placeholder="Title…"
        />
        <Button
          label="Add reminder"
          variant="secondary"
          disabled={!reminderTitle.trim()}
          onPress={async () => {
            const dueAt = booking.scheduled_start_at_ms
              ? booking.scheduled_start_at_ms - 60 * 60 * 1000
              : Date.now() + 60 * 60 * 1000;
            await createReminder({
              title: reminderTitle.trim(),
              bookingId: booking.id,
              dueAt,
            });
            setReminderTitle("");
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  label: { letterSpacing: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
});
