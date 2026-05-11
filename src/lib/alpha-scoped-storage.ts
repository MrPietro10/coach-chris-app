import { getActiveAlphaStorageNamespace } from "@/lib/alpha-session-store";

export const ALPHA_STORAGE_PREFIX = "coachChris";

export type AlphaScopedStorageResource =
  | "resume"
  | "profile"
  | "jobs"
  | "analyzed-jobs"
  | "analyses"
  | "selected-job"
  | "pending-analysis-job"
  | "job-statuses"
  | "job-status-timestamps"
  | "usage-logs"
  | "chris-chat";

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
  if (!key) return null;
  return window.localStorage.getItem(key);
}

export function writeAlphaScopedStorageItem(resource: AlphaScopedStorageResource, value: string): boolean {
  if (!isBrowser()) return false;
  const key = buildAlphaScopedStorageKey(resource);
  if (!key) return false;
  window.localStorage.setItem(key, value);
  return true;
}

export function removeAlphaScopedStorageItem(resource: AlphaScopedStorageResource): boolean {
  if (!isBrowser()) return false;
  const key = buildAlphaScopedStorageKey(resource);
  if (!key) return false;
  window.localStorage.removeItem(key);
  return true;
}
