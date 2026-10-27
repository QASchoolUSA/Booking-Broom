/** Voip.ms sendSMS single-segment limit. */
export const SMS_SEGMENT_MAX = 160;
/** Voip.ms sendMMS text-only limit. */
export const MMS_TEXT_MAX = 2048;

export function messageChannelLabel(length: number): "SMS" | "MMS" {
  return length > SMS_SEGMENT_MAX ? "MMS" : "SMS";
}

/** Counter text: `12/160 SMS` or `200/2048 MMS`. */
export function messageLengthLabel(length: number): string {
  const channel = messageChannelLabel(length);
  const max = channel === "MMS" ? MMS_TEXT_MAX : SMS_SEGMENT_MAX;
  return `${length}/${max} ${channel}`;
}
