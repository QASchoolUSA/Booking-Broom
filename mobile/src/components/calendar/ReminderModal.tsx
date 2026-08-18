import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { format } from "date-fns";
import { X } from "lucide-react-native";
import { api } from "@/lib/api";
import type { Id } from "@/lib/api";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import { AppText, Button, TextField } from "@/components/ui";
import { wallTimeToUtcMs } from "@/lib/calendar-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  initialDue?: Date;
  bookingId?: string | null;
};

function toDateStr(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function toTimeStr(d: Date) {
  return format(d, "HH:mm");
}

export function ReminderModal({
  open,
  onClose,
  initialDue,
  bookingId,
}: Props) {
  const { colors } = useTheme();
  const createReminder = useMutation(api.reminders.create);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dateStr, setDateStr] = useState(() =>
    toDateStr(initialDue ?? new Date())
  );
  const [timeStr, setTimeStr] = useState(() =>
    toTimeStr(initialDue ?? new Date())
  );
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = initialDue ?? new Date();
    setTitle("");
    setNotes("");
    setDateStr(toDateStr(base));
    setTimeStr(toTimeStr(base));
    setAllDay(false);
    setError(null);
  }, [open, initialDue]);

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = (allDay ? "09:00" : timeStr).split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
      setError("Use date YYYY-MM-DD and time HH:mm");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dueAt = wallTimeToUtcMs(y, m, d, hh, mm);
      await createReminder({
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueAt,
        allDay,
        bookingId: bookingId
          ? (bookingId as Id<"bookings">)
          : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create reminder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <AppText weight="bold" size={18}>
            New reminder
          </AppText>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <X size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Call customer…"
          />
          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            multiline
          />
          <View style={styles.row}>
            <AppText size={14}>All day</AppText>
            <Switch value={allDay} onValueChange={setAllDay} />
          </View>
          <TextField
            label="Date (YYYY-MM-DD)"
            value={dateStr}
            onChangeText={setDateStr}
            placeholder="2026-08-16"
            autoCapitalize="none"
          />
          {!allDay ? (
            <TextField
              label="Time (HH:mm)"
              value={timeStr}
              onChangeText={setTimeStr}
              placeholder="09:00"
              autoCapitalize="none"
            />
          ) : null}
          {error ? (
            <AppText size={13} style={{ color: colors.destructive }}>
              {error}
            </AppText>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button
            label="Create reminder"
            onPress={handleSave}
            loading={saving}
            disabled={!title.trim()}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footer: {
    padding: spacing.lg,
  },
});
