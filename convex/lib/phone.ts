/**
 * Pull a US contact phone from cleaning-site HTML.
 * Prefers tel: links, then common display formats.
 */

export function normalizeUsDigits(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return null;
  return digits;
}

/** Format 10 digits as (321) 347-4518. */
export function formatUsPhone(digitsOrRaw: string): string | null {
  const digits = normalizeUsDigits(digitsOrRaw);
  if (!digits) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function extractPhoneFromHtml(html: string): string | null {
  const telMatches = html.matchAll(/tel:([+\d().\-\s]+)/gi);
  for (const match of telMatches) {
    const formatted = formatUsPhone(match[1] ?? "");
    if (formatted) return formatted;
  }

  const textMatches = html.matchAll(
    /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g
  );
  for (const match of textMatches) {
    const formatted = formatUsPhone(match[0] ?? "");
    if (formatted) return formatted;
  }

  return null;
}
