/** Encode SMS thread identity for expo-router params. */
export function encodeSmsThreadId(did: string, contact: string): string {
  return encodeURIComponent(`${did}|${contact}`);
}

export function decodeSmsThreadId(
  threadId: string
): { did: string; contact: string } | null {
  try {
    const raw = decodeURIComponent(threadId);
    const i = raw.indexOf("|");
    if (i <= 0 || i >= raw.length - 1) return null;
    return { did: raw.slice(0, i), contact: raw.slice(i + 1) };
  } catch {
    return null;
  }
}
