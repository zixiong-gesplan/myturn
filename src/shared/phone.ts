import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhone(input: string, defaultCountry: "ES" = "ES"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const digits = e164.replace(/[^\d+]/g, "");
  if (digits.length < 6) return "••••";
  return `${digits.slice(0, 3)}••••${digits.slice(-2)}`;
}

export function isLikelySameDeviceRecoveryAllowed(): boolean {
  return true;
}
