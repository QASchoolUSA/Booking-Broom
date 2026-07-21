import type { SmsDid } from "@/lib/types";

/** Strip Voip.ms account id prefix, e.g. 100001_sanford → sanford. */
export function cleanSubAccountLabel(subAccount: string | null | undefined): string {
  if (!subAccount?.trim()) return "";
  const raw = subAccount.trim();
  const withoutId = raw.replace(/^\d+_/, "");
  return (withoutId || raw).trim();
}

/**
 * Primary label for a DID in filters/sidebar.
 * Prefer stored description (synced from Caller ID Prefix / note),
 * else cleaned sub-account; never the raw phone digits.
 */
export function didDisplayLabel(did: Pick<SmsDid, "description" | "sub_account" | "did" | "formatted">): string {
  const desc = did.description?.trim() ?? "";
  const digits = did.did.replace(/\D/g, "").slice(-10);
  const descIsJustDid =
    Boolean(digits) && desc.replace(/\D/g, "") === digits;

  if (desc && !descIsJustDid) return desc;

  const fromSub = cleanSubAccountLabel(did.sub_account);
  if (fromSub) return fromSub;

  return "Unlabeled";
}

/** Whether the primary label came from the sub-account (so we skip repeating it). */
export function didLabelUsesSubAccount(
  did: Pick<SmsDid, "description" | "sub_account" | "did">
): boolean {
  const desc = did.description?.trim() ?? "";
  const digits = did.did.replace(/\D/g, "").slice(-10);
  const descIsJustDid =
    Boolean(digits) && desc.replace(/\D/g, "") === digits;
  if (desc && !descIsJustDid) return false;
  return Boolean(cleanSubAccountLabel(did.sub_account));
}
