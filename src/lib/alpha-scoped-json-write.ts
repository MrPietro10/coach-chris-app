import {
  writeAlphaScopedStorageItem,
  type AlphaScopedStorageResource,
} from "@/lib/alpha-scoped-storage";

export const STORAGE_WRITE_FAILURE_MESSAGE =
  "Coach Chris could not save this change in your browser. Export your work or clear old jobs/resumes before continuing.";

export const STORAGE_WRITE_FAILED_EVENT = "career-coach:storage-write-failed";

export function notifyStorageWriteFailure(resource: AlphaScopedStorageResource): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(STORAGE_WRITE_FAILED_EVENT, {
      detail: { resource },
    }),
  );
}

/** Persist JSON to alpha-scoped storage without mutating prior state on failure. */
export function writeScopedJson(
  resource: AlphaScopedStorageResource,
  value: unknown,
): boolean {
  const ok = writeAlphaScopedStorageItem(resource, JSON.stringify(value));
  if (!ok) {
    notifyStorageWriteFailure(resource);
  }
  return ok;
}

/** Persist a plain string value (non-JSON) to alpha-scoped storage. */
export function writeScopedPlainItem(
  resource: AlphaScopedStorageResource,
  value: string,
): boolean {
  const ok = writeAlphaScopedStorageItem(resource, value);
  if (!ok) {
    notifyStorageWriteFailure(resource);
  }
  return ok;
}
