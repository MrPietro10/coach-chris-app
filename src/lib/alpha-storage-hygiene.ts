import {
  readAlphaScopedStorageItem,
  removeAlphaScopedStorageItem,
  warnAlphaStorageFailure,
} from "@/lib/alpha-scoped-storage";
import { writeScopedJson } from "@/lib/alpha-scoped-json-write";
import type { AlphaScopedStorageResource } from "@/lib/alpha-storage-catalog";
import { clearPendingParseDraft } from "@/lib/pending-parse-draft";
import { clearPendingTailoredDraftsForJobs } from "@/lib/pending-tailored-drafts";
import type { ProfileData } from "@/types/coach";

const CURRENT_STORAGE_SCHEMA_VERSION = 1;

type StorageMeta = {
  schemaVersion: number;
  migratedAt?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readScopedJson<T>(resource: AlphaScopedStorageResource): T | null {
  return parseJson<T>(readAlphaScopedStorageItem(resource));
}

function readResumeIds(): string[] {
  const parsed = readScopedJson<Array<{ id?: string }>>("resumes");
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
    .filter((id) => id.length > 0);
}

function readRemovedJobIds(): Set<string> {
  const parsed = readScopedJson<unknown>("removed-jobs");
  if (!Array.isArray(parsed)) return new Set();
  return new Set(
    parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
  );
}

function readStoredJobIds(): Set<string> {
  const parsed = readScopedJson<Array<{ id?: string }>>("jobs");
  if (!Array.isArray(parsed)) return new Set();
  return new Set(
    parsed
      .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
      .filter((id) => id.length > 0),
  );
}

function readProfile(): ProfileData {
  const parsed = readScopedJson<Partial<ProfileData>>("profile");
  return {
    fullName: typeof parsed?.fullName === "string" ? parsed.fullName : "",
    location: typeof parsed?.location === "string" ? parsed.location : "",
    workPermit: typeof parsed?.workPermit === "string" ? parsed.workPermit : "",
    languages: Array.isArray(parsed?.languages)
      ? parsed.languages.filter((item): item is string => typeof item === "string")
      : [],
    desiredIndustries: Array.isArray(parsed?.desiredIndustries)
      ? parsed.desiredIndustries.filter((item): item is string => typeof item === "string")
      : [],
    desiredRoles: Array.isArray(parsed?.desiredRoles)
      ? parsed.desiredRoles.filter((item): item is string => typeof item === "string")
      : [],
    activeResumeId: typeof parsed?.activeResumeId === "string" ? parsed.activeResumeId : "",
  };
}

function syncProfileActiveResumeId(resumeId: string): void {
  const profile = readProfile();
  writeScopedJson("profile", { ...profile, activeResumeId: resumeId });
}

function pruneStringRecordKeys(
  resource: AlphaScopedStorageResource,
  dropJobId: (jobId: string) => boolean,
): boolean {
  const parsed = readScopedJson<Record<string, string>>(resource);
  if (!parsed || typeof parsed !== "object") return false;

  let changed = false;
  const next: Record<string, string> = {};
  for (const [jobId, value] of Object.entries(parsed)) {
    if (dropJobId(jobId)) {
      changed = true;
      continue;
    }
    next[jobId] = value;
  }

  if (changed) {
    writeScopedJson(resource, next);
  }
  return changed;
}

/** Clear resume-linked scoped keys when a version is removed. */
export function clearResumeRelatedStorage(
  resumeId: string,
  options: { wasActive: boolean },
): void {
  if (!isBrowser()) return;

  const trimmed = resumeId.trim();
  if (!trimmed) return;

  if (options.wasActive) {
    clearPendingParseDraft();
    removeAlphaScopedStorageItem("resume");
  }

  const pendingResumeId = readAlphaScopedStorageItem("pending-analysis-resume-id")?.trim();
  if (pendingResumeId === trimmed) {
    removeAlphaScopedStorageItem("pending-analysis-resume-id");
  }

  const profile = readProfile();
  if (profile.activeResumeId.trim() === trimmed) {
    const remaining = readResumeIds().filter((id) => id !== trimmed);
    syncProfileActiveResumeId(remaining[0] ?? "");
  }
}

/** Drop stale resume pointers and legacy blobs after versions are gone. */
export function pruneOrphanResumeReferences(): void {
  if (!isBrowser()) return;

  const resumeIds = new Set(readResumeIds());

  if (resumeIds.size === 0) {
    removeAlphaScopedStorageItem("active-resume-id");
    removeAlphaScopedStorageItem("resume");
    clearPendingParseDraft();
    const profile = readProfile();
    if (profile.activeResumeId.trim()) {
      syncProfileActiveResumeId("");
    }
    return;
  }

  const activeId = readAlphaScopedStorageItem("active-resume-id")?.trim() ?? "";
  if (activeId && !resumeIds.has(activeId)) {
    removeAlphaScopedStorageItem("active-resume-id");
  }

  const pendingResumeId = readAlphaScopedStorageItem("pending-analysis-resume-id")?.trim() ?? "";
  if (pendingResumeId && !resumeIds.has(pendingResumeId)) {
    removeAlphaScopedStorageItem("pending-analysis-resume-id");
  }

  const profile = readProfile();
  const profileResumeId = profile.activeResumeId.trim();
  if (profileResumeId && !resumeIds.has(profileResumeId)) {
    const fallback = [...resumeIds][0] ?? "";
    syncProfileActiveResumeId(fallback);
  }
}

function pruneRemovedJobWorkspaceState(): void {
  const removed = readRemovedJobIds();
  if (removed.size === 0) return;

  const drop = (jobId: string) => removed.has(jobId);

  const analyzed = readScopedJson<Record<string, boolean>>("analyzed-jobs") ?? {};
  let analyzedChanged = false;
  const nextAnalyzed: Record<string, boolean> = {};
  for (const [jobId, value] of Object.entries(analyzed)) {
    if (drop(jobId)) {
      analyzedChanged = true;
      continue;
    }
    nextAnalyzed[jobId] = value;
  }
  if (analyzedChanged) {
    writeScopedJson("analyzed-jobs", nextAnalyzed);
  }

  const computed = readScopedJson<Record<string, unknown>>("analyses") ?? {};
  let computedChanged = false;
  const nextComputed: Record<string, unknown> = {};
  for (const [jobId, value] of Object.entries(computed)) {
    if (drop(jobId)) {
      computedChanged = true;
      continue;
    }
    nextComputed[jobId] = value;
  }
  if (computedChanged) {
    writeScopedJson("analyses", nextComputed);
  }

  pruneStringRecordKeys("job-statuses", drop);
  pruneStringRecordKeys("job-status-timestamps", drop);
  pruneStringRecordKeys("job-application-notes", drop);

  const selectedJobId = readAlphaScopedStorageItem("selected-job")?.trim() ?? "";
  if (selectedJobId && drop(selectedJobId)) {
    removeAlphaScopedStorageItem("selected-job");
  }

  const pendingJobId = readAlphaScopedStorageItem("pending-analysis-job")?.trim() ?? "";
  if (pendingJobId && drop(pendingJobId)) {
    removeAlphaScopedStorageItem("pending-analysis-job");
    removeAlphaScopedStorageItem("pending-analysis-resume-id");
  }

  clearPendingTailoredDraftsForJobs(removed);
}

function pruneDeletedUserJobAnalyses(): void {
  const storedJobIds = readStoredJobIds();
  const removed = readRemovedJobIds();

  const dropStoredOnly = (jobId: string) => {
    if (removed.has(jobId)) return true;
    if (jobId.startsWith("job_user_") || jobId.startsWith("job_import_")) {
      return !storedJobIds.has(jobId);
    }
    return false;
  };

  const analyzed = readScopedJson<Record<string, boolean>>("analyzed-jobs") ?? {};
  let analyzedChanged = false;
  const nextAnalyzed: Record<string, boolean> = {};
  for (const [jobId, value] of Object.entries(analyzed)) {
    if (dropStoredOnly(jobId)) {
      analyzedChanged = true;
      continue;
    }
    nextAnalyzed[jobId] = value;
  }
  if (analyzedChanged) {
    writeScopedJson("analyzed-jobs", nextAnalyzed);
  }

  const computed = readScopedJson<Record<string, unknown>>("analyses") ?? {};
  let computedChanged = false;
  const nextComputed: Record<string, unknown> = {};
  for (const [jobId, value] of Object.entries(computed)) {
    if (dropStoredOnly(jobId)) {
      computedChanged = true;
      continue;
    }
    nextComputed[jobId] = value;
  }
  if (computedChanged) {
    writeScopedJson("analyses", nextComputed);
  }

  pruneStringRecordKeys("job-statuses", dropStoredOnly);
  pruneStringRecordKeys("job-status-timestamps", dropStoredOnly);
  pruneStringRecordKeys("job-application-notes", dropStoredOnly);
}

function clearLegacyResumeAfterVersionMigration(): void {
  const resumeIds = readResumeIds();
  if (resumeIds.length === 0) return;
  if (readAlphaScopedStorageItem("resume")) {
    removeAlphaScopedStorageItem("resume");
  }
}

/** Prune orphan resume/job references without deleting user data intentionally kept. */
export function runAlphaStorageHygiene(): void {
  if (!isBrowser()) return;

  clearLegacyResumeAfterVersionMigration();
  pruneOrphanResumeReferences();
  pruneRemovedJobWorkspaceState();
  pruneDeletedUserJobAnalyses();
}

export function runAlphaStorageMigration(): void {
  if (!isBrowser()) return;

  const meta = readScopedJson<StorageMeta>("storage-meta") ?? { schemaVersion: 0 };

  try {
    runAlphaStorageHygiene();

    if (meta.schemaVersion < CURRENT_STORAGE_SCHEMA_VERSION) {
      writeScopedJson("storage-meta", {
        schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
        migratedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    warnAlphaStorageFailure("migration", "storage-meta", error);
  }
}
