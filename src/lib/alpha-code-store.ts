const ALPHA_CODE_STORAGE_KEY = "alphaCode";

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

export const VALID_CODES = [
  "alpha-glen",
  "alpha-mom",
  "alpha-riko",
  "alpha-bb1",
  "alpha-mba1",
] as const;

export function isValidAlphaCode(value: string): boolean {
  const normalized = normalizeCode(value);
  return VALID_CODES.includes(normalized as (typeof VALID_CODES)[number]);
}

export function getStoredAlphaCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ALPHA_CODE_STORAGE_KEY);
}

export function setStoredAlphaCode(enteredCode: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ALPHA_CODE_STORAGE_KEY, enteredCode);
}
