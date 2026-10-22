/**
 * Normalizes a phone number to E.164 (e.g. "+923001234567").
 * Accepts Pakistani local formats like "0300-1234567" and "3001234567",
 * and international numbers that start with "+" or "00".
 * Returns null when the input is not a plausible phone number.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (!/^[+\d\s\-()]+$/.test(raw)) return null;

  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (/^03\d{9}$/.test(digits)) {
    digits = `92${digits.slice(1)}`;
  } else if (/^3\d{9}$/.test(digits)) {
    digits = `92${digits}`;
  }

  if (digits.startsWith("92") && !/^923\d{9}$/.test(digits) && !/^92\d{9,10}$/.test(digits)) {
    return null;
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

/** "+923001234567" -> "0300-1234567"; other countries are shown as stored. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+92(3\d{2})(\d{7})$/.exec(e164);
  return m ? `0${m[1]}-${m[2]}` : e164;
}

/** Digits only, as WhatsApp's wa.me links expect. */
export function waDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}
