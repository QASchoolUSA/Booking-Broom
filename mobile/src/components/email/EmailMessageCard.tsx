import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";
import { formatDistanceToNow } from "date-fns";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

export type EmailAttachmentChip = {
  filename: string;
  size?: number;
  skipped?: boolean;
};

export type EmailMessageCardProps = {
  from: string;
  subject: string;
  sentAt: string;
  textBody: string | null;
  htmlBody: string | null;
  attachments?: EmailAttachmentChip[];
};

function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
}

export function EmailMessageCard({
  from,
  subject,
  sentAt,
  textBody,
  htmlBody,
  attachments = [],
}: EmailMessageCardProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [preferPlain, setPreferPlain] = useState(false);

  const sanitizedHtml = useMemo(
    () => (htmlBody ? sanitizeEmailHtml(htmlBody) : null),
    [htmlBody]
  );

  const showHtml = Boolean(sanitizedHtml) && !preferPlain;
  const contentWidth = Math.max(240, width - spacing.lg * 4);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText muted size={11} weight="semibold" style={styles.label}>
        From
      </AppText>
      <AppText weight="semibold" size={15} numberOfLines={2}>
        {from}
      </AppText>
      <AppText muted size={12} style={{ marginTop: 4 }}>
        {formatDistanceToNow(new Date(sentAt), { addSuffix: true })}
      </AppText>
      {subject ? (
        <AppText
          size={13}
          weight="medium"
          style={{ marginTop: spacing.sm }}
          numberOfLines={2}
        >
          {subject}
        </AppText>
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {sanitizedHtml && textBody ? (
        <Pressable
          onPress={() => setPreferPlain((v) => !v)}
          hitSlop={8}
          style={{ marginBottom: spacing.sm }}
        >
          <AppText size={11} weight="medium" style={{ color: colors.primary }}>
            {preferPlain ? "Show formatted" : "Show plain text"}
          </AppText>
        </Pressable>
      ) : null}

      {showHtml && sanitizedHtml ? (
        <RenderHTML
          contentWidth={contentWidth}
          source={{ html: sanitizedHtml }}
          baseStyle={{
            color: colors.foreground,
            fontSize: 14,
            lineHeight: 22,
          }}
          tagsStyles={{
            a: { color: colors.primary },
            p: { marginTop: 0, marginBottom: 10 },
            img: { maxWidth: contentWidth },
          }}
        />
      ) : (
        <AppText size={14} style={styles.plain}>
          {textBody || (htmlBody ? "" : "(empty message)")}
        </AppText>
      )}

      {attachments.length > 0 ? (
        <View style={styles.attachments}>
          {attachments.map((att, i) => (
            <View
              key={`${att.filename}-${i}`}
              style={[
                styles.chip,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <AppText size={11} numberOfLines={1}>
                {att.filename}
                {att.skipped ? " (skipped)" : ""}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  plain: {
    lineHeight: 22,
  },
  attachments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: "100%",
  },
});
