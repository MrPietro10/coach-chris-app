import { isValidAlphaCode, normalizeAlphaCode } from "@/lib/alpha-code-store";

export const ACTIVE_ALPHA_SESSION_STORAGE_KEY = "coachChris:active-alpha-session";
export const ADMIN_ALPHA_STORAGE_NAMESPACE = "admin-pietro";
export const ALPHA_SESSION_CHANGED_EVENT = "career-coach:alpha-session-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function dispatchAlphaSessionChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(ALPHA_SESSION_CHANGED_EVENT));
}

export function getActiveAlphaStorageNamespace(): string | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(ACTIVE_ALPHA_SESSION_STORAGE_KEY);
  if (!raw || raw.trim().length === 0) return null;
  const normalized = normalizeAlphaCode(raw);
  if (normalized === ADMIN_ALPHA_STORAGE_NAMESPACE) return normalized;
  if (!isValidAlphaCode(normalized)) return null;
  return normalized;
}

export function setActiveAlphaStorageNamespace(code: string): void {
  if (!isBrowser()) return;
  const normalized = normalizeAlphaCode(code);
  if (normalized !== ADMIN_ALPHA_STORAGE_NAMESPACE && !isValidAlphaCode(normalized)) return;
  window.sessionStorage.setItem(ACTIVE_ALPHA_SESSION_STORAGE_KEY, normalized);
  dispatchAlphaSessionChanged();
}

export function clearActiveAlphaStorageNamespace(): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(ACTIVE_ALPHA_SESSION_STORAGE_KEY);
  dispatchAlphaSessionChanged();
}
