/** Strict US 10-digit NANP number. */
export function normalizeUsDigits(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return null;
  return digits;
}

/** Format 10 digits as (321) 347-4518. Falls back to raw if not NANP. */
export function formatUsPhone(digitsOrRaw: string): string {
  const digits = normalizeUsDigits(digitsOrRaw);
  if (!digits) return digitsOrRaw.trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
