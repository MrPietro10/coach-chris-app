export const ALPHA_CODE_STORAGE_KEY = "alphaCode";

export function normalizeAlphaCode(value: string): string {
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
  const normalized = normalizeAlphaCode(value);
  return VALID_CODES.includes(normalized as (typeof VALID_CODES)[number]);
}

export function clearPersistedAlphaCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ALPHA_CODE_STORAGE_KEY);
}
