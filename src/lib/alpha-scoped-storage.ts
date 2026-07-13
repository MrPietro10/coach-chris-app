import { getActiveAlphaStorageNamespace } from "@/lib/alpha-session-store";
import type { AlphaScopedStorageResource } from "@/lib/alpha-storage-catalog";

export { ALPHA_SCOPED_STORAGE_RESOURCES } from "@/lib/alpha-storage-catalog";
export type { AlphaScopedStorageResource } from "@/lib/alpha-storage-catalog";

export const ALPHA_STORAGE_PREFIX = "coachChris";

export function warnAlphaStorageFailure(
  action: "read" | "write" | "remove" | "migration",
  resource: AlphaScopedStorageResource | "namespace",
  error: unknown,
): void {
  if (typeof window === "undefined") return;
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[coachChris:storage] ${action} failed for "${resource}": ${detail}`);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function buildAlphaScopedStorageKey(resource: AlphaScopedStorageResource): string | null {
  const namespace = getActiveAlphaStorageNamespace();
  if (!namespace) return null;
  return `${ALPHA_STORAGE_PREFIX}:${namespace}:${resource}`;
}

export function readAlphaScopedStorageItem(resource: AlphaScopedStorageResource): string | null {
  if (!isBrowser()) return null;
  const key = buildAlphaScopedStorageKey(resource);
  if (!key) {
    warnAlphaStorageFailure("read", "namespace", new Error("No active alpha namespace"));
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    warnAlphaStorageFailure("read", resource, error);
    return null;
  }
}

export function writeAlphaScopedStorageItem(resource: AlphaScopedStorageResource, value: string): boolean {
  if (!isBrowser()) return false;
  const key = buildAlphaScopedStorageKey(resource);
  if (!key) {
    warnAlphaStorageFailure("write", "namespace", new Error("No active alpha namespace"));
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    warnAlphaStorageFailure("write", resource, error);
    return false;
  }
}

export function removeAlphaScopedStorageItem(resource: AlphaScopedStorageResource): boolean {
  if (!isBrowser()) return false;
  const key = buildAlphaScopedStorageKey(resource);
  if (!key) {
    warnAlphaStorageFailure("remove", "namespace", new Error("No active alpha namespace"));
    return false;
  }
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    warnAlphaStorageFailure("remove", resource, error);
    return false;
  }
}
