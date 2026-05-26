import {
  readAlphaScopedStorageItem,
  removeAlphaScopedStorageItem,
  type AlphaScopedStorageResource,
  writeAlphaScopedStorageItem,
} from "@/lib/alpha-scoped-storage";
import { clearJobPipelineState, getJobApplicationNotes, getStoredJobStatuses } from "@/lib/job-pipeline-store";
import { resolveJobStatus } from "@/lib/job-pipeline";
import {
  buildLatestAnalysisRef,
  jobPostingToStoredRecord,
  sanitizeStoredJobRecord,
  storedJobToJobPosting,
  type StoredJobRecord,
  type StoredJobView,
} from "@/lib/stored-job";
import type {
  ConfidenceLevel,
  FitCategory,
  JobAnalysis,
  JobPosting,
  ProfileData,
} from "@/types/coach";

export type { LatestAnalysisReference, StoredJobRecord, StoredJobView } from "@/lib/stored-job";

export const JOB_WORKSPACE_CHANGED_EVENT = "career-coach:job-workspace-changed";

export type AnalyzedJobsState = Record<string, boolean>;
export type ComputedAnalysisState = "ready" | "insufficient_evidence";
export type ComputedJobAnalysis = JobAnalysis & {
  analysisState: ComputedAnalysisState;
  source: "computed-v1";
  missingEvidence: string[];
  inputFingerprint?: string;
  confidenceLevel?: ConfidenceLevel;
};
export type ComputedJobAnalysesState = Record<string, ComputedJobAnalysis>;

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

function writeScopedJson(resource: AlphaScopedStorageResource, value: unknown): void {
  writeAlphaScopedStorageItem(resource, JSON.stringify(value));
}

function removeScoped(resource: AlphaScopedStorageResource): void {
  removeAlphaScopedStorageItem(resource);
}

function readStoredJobRecords(): StoredJobRecord[] {
  if (!isBrowser()) return [];
  const parsed = readScopedJson<Partial<StoredJobRecord>[]>("jobs");
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => sanitizeStoredJobRecord(entry))
    .filter((entry): entry is StoredJobRecord => entry !== null);
}

function writeStoredJobRecords(records: StoredJobRecord[]): void {
  writeScopedJson("jobs", records);
}

function syncLatestAnalysisRefOnRecord(
  record: StoredJobRecord,
  analysis: ComputedJobAnalysis,
): StoredJobRecord {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    latestAnalysisRef: buildLatestAnalysisRef(analysis),
  };
}

export function getStoredUserJobs(): JobPosting[] {
  return readStoredJobRecords().map(storedJobToJobPosting);
}

export function getStoredJobRecords(): StoredJobRecord[] {
  return readStoredJobRecords();
}

export function getStoredJobViews(): StoredJobView[] {
  const records = readStoredJobRecords();
  const statuses = getStoredJobStatuses();
  const notes = getJobApplicationNotes();
  const computed = getComputedJobAnalysesState();
  const analyzed = getAnalyzedJobsState();

  return records.map((record) => {
    const hasAnalysis =
      record.latestAnalysisRef?.analysisState === "ready" ||
      computed[record.id]?.analysisState === "ready" ||
      Boolean(analyzed[record.id]);
    return {
      ...record,
      pipelineStatus: resolveJobStatus(record.id, statuses, { hasAnalysis }),
      notes: notes[record.id] ?? "",
    };
  });
}

export function getStoredJobView(jobId: string): StoredJobView | null {
  return getStoredJobViews().find((view) => view.id === jobId) ?? null;
}

export function saveUserJob(
  job: JobPosting,
  options?: { sourceUrl?: string },
): StoredJobRecord | null {
  if (!isBrowser()) return null;
  const existing = readStoredJobRecords();
  if (existing.some((item) => item.id === job.id)) return null;
  const record = jobPostingToStoredRecord(job, { sourceUrl: options?.sourceUrl ?? job.jobUrl });
  writeStoredJobRecords([record, ...existing]);
  dispatchJobWorkspaceChanged();
  return record;
}

export type SpreadsheetJobImportInput = {
  title: string;
  company: string;
  location: string;
  jobUrl?: string;
  description: string;
};

export function jobPostingFromSpreadsheetRow(
  row: SpreadsheetJobImportInput,
  id = buildSessionJobId("job_import"),
): JobPosting | null {
  const record = sanitizeStoredJobRecord({
    id,
    title: row.title,
    company: row.company,
    location: row.location,
    sourceUrl: row.jobUrl,
    description: row.description,
    source: "manual_upload",
    requiredSkills: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return record ? storedJobToJobPosting(record) : null;
}

/** Merge spreadsheet rows into alpha-scoped jobs storage (skips invalid rows). */
export function saveImportedUserJobs(rows: SpreadsheetJobImportInput[]): JobPosting[] {
  if (!isBrowser()) return [];
  const existing = readStoredJobRecords();
  const existingIds = new Set(existing.map((job) => job.id));
  const imported: JobPosting[] = [];

  for (const row of rows) {
    const job = jobPostingFromSpreadsheetRow(row);
    if (!job || existingIds.has(job.id)) continue;
    imported.push(job);
    existingIds.add(job.id);
  }

  if (imported.length === 0) return [];
  const importedRecords = imported.map((job) => jobPostingToStoredRecord(job));
  writeStoredJobRecords([...importedRecords, ...existing]);
  dispatchJobWorkspaceChanged();
  return imported;
}

function getRemovedJobIds(): Set<string> {
  if (!isBrowser()) return new Set();
  const parsed = readScopedJson<unknown>("removed-jobs");
  if (!Array.isArray(parsed)) return new Set();
  const ids = parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return new Set(ids);
}

function addRemovedJobId(jobId: string): void {
  if (!isBrowser()) return;
  const trimmed = jobId.trim();
  if (!trimmed) return;
  const removed = getRemovedJobIds();
  removed.add(trimmed);
  writeScopedJson("removed-jobs", [...removed]);
}

function dispatchJobWorkspaceChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(JOB_WORKSPACE_CHANGED_EVENT));
  window.dispatchEvent(new Event("career-coach:analysis-updated"));
}

export function getAllStoredJobs(baseJobs: JobPosting[]): JobPosting[] {
  const removed = getRemovedJobIds();
  const visibleBaseJobs = baseJobs.filter((job) => !removed.has(job.id));
  const userJobs = getStoredUserJobs();
  const baseIds = new Set(visibleBaseJobs.map((job) => job.id));
  const seenUserIds = new Set<string>();
  const dedupedUserJobs = userJobs.filter((job) => {
    if (removed.has(job.id)) return false;
    if (baseIds.has(job.id)) return false;
    if (seenUserIds.has(job.id)) return false;
    seenUserIds.add(job.id);
    return true;
  });
  return [...visibleBaseJobs, ...dedupedUserJobs];
}

export function buildSessionJobId(prefix = "job_user"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSelectedJobId(): string | null {
  if (!isBrowser()) return null;
  const value = readAlphaScopedStorageItem("selected-job");
  return value && value.trim().length > 0 ? value : null;
}

export function setSelectedJobId(jobId: string): void {
  if (!isBrowser()) return;
  writeAlphaScopedStorageItem("selected-job", jobId);
  if (isBrowser()) {
    window.dispatchEvent(new Event("career-coach:active-job-changed"));
  }
}

export function markPendingAnalysisJobId(jobId: string): void {
  if (!isBrowser()) return;
  writeAlphaScopedStorageItem("pending-analysis-job", jobId);
  window.dispatchEvent(new Event("career-coach:active-job-changed"));
}

export function getPendingAnalysisJobId(): string | null {
  if (!isBrowser()) return null;
  const value = readAlphaScopedStorageItem("pending-analysis-job");
  return value && value.trim().length > 0 ? value : null;
}

export function clearPendingAnalysisJobId(): void {
  if (!isBrowser()) return;
  removeScoped("pending-analysis-job");
  window.dispatchEvent(new Event("career-coach:active-job-changed"));
}

export function clearSelectedJobId(): void {
  if (!isBrowser()) return;
  removeScoped("selected-job");
}

export function getAnalyzedJobsState(): AnalyzedJobsState {
  if (!isBrowser()) return {};
  const parsed = readScopedJson<Record<string, unknown>>("analyzed-jobs");
  if (!parsed || typeof parsed !== "object") return {};
  const state: AnalyzedJobsState = {};
  for (const [jobId, value] of Object.entries(parsed)) {
    if (typeof value === "boolean") state[jobId] = value;
  }
  return state;
}

export function setJobAnalyzed(jobId: string, analyzed: boolean): void {
  if (!isBrowser()) return;
  const current = getAnalyzedJobsState();
  current[jobId] = analyzed;
  writeScopedJson("analyzed-jobs", current);
}

function sanitizeFit(value: unknown): FitCategory | null {
  if (value === "No Fit") return "Low Fit";
  if (
    value === "Strong Fit" ||
    value === "Backup Fit" ||
    value === "Aspirational Fit" ||
    value === "Low Fit"
  ) {
    return value;
  }
  return null;
}

function sanitizeComputedJobAnalysis(
  raw: Partial<ComputedJobAnalysis>,
): ComputedJobAnalysis | null {
  if (!raw.jobId) return null;
  const fit = sanitizeFit(raw.fit);
  if (!fit) return null;
  if (typeof raw.score !== "number") return null;
  const analysisState =
    raw.analysisState === "insufficient_evidence" ? "insufficient_evidence" : "ready";
  const confidenceLevel =
    raw.confidenceLevel === "Low" ||
    raw.confidenceLevel === "Medium" ||
    raw.confidenceLevel === "High"
      ? raw.confidenceLevel
      : undefined;
  return {
    jobId: raw.jobId,
    fit,
    score: Math.max(0, Math.min(100, Math.round(raw.score))),
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.filter((item): item is string => typeof item === "string")
      : [],
    gaps: Array.isArray(raw.gaps)
      ? raw.gaps.filter((item): item is string => typeof item === "string")
      : [],
    hrView: Array.isArray(raw.hrView)
      ? raw.hrView.filter((item): item is string => typeof item === "string")
      : [],
    suggestedEdits: Array.isArray(raw.suggestedEdits)
      ? raw.suggestedEdits.filter((item): item is string => typeof item === "string")
      : [],
    suggestedQuestions: Array.isArray(raw.suggestedQuestions)
      ? raw.suggestedQuestions.filter((item): item is string => typeof item === "string")
      : [],
    source: "computed-v1",
    analysisState,
    missingEvidence: Array.isArray(raw.missingEvidence)
      ? raw.missingEvidence.filter((item): item is string => typeof item === "string")
      : [],
    inputFingerprint:
      typeof raw.inputFingerprint === "string" && raw.inputFingerprint.trim().length > 0
        ? raw.inputFingerprint.trim()
        : undefined,
    confidenceLevel,
  };
}

export function getComputedJobAnalysesState(): ComputedJobAnalysesState {
  if (!isBrowser()) return {};
  const parsed = readScopedJson<Record<string, Partial<ComputedJobAnalysis>>>("analyses");
  if (!parsed || typeof parsed !== "object") return {};
  const out: ComputedJobAnalysesState = {};
  for (const [jobId, value] of Object.entries(parsed)) {
    const sanitized = sanitizeComputedJobAnalysis({ ...value, jobId });
    if (sanitized) out[jobId] = sanitized;
  }
  return out;
}

export function setComputedJobAnalysis(analysis: ComputedJobAnalysis): void {
  if (!isBrowser()) return;
  const current = getComputedJobAnalysesState();
  current[analysis.jobId] = analysis;
  writeScopedJson("analyses", current);

  const records = readStoredJobRecords();
  const index = records.findIndex((record) => record.id === analysis.jobId);
  if (index >= 0) {
    records[index] = syncLatestAnalysisRefOnRecord(records[index], analysis);
    writeStoredJobRecords(records);
  }
}

export function clearJobAnalysisState(jobId: string): void {
  if (!isBrowser()) return;
  const analyzed = getAnalyzedJobsState();
  if (jobId in analyzed) {
    delete analyzed[jobId];
    writeScopedJson("analyzed-jobs", analyzed);
  }

  const computed = getComputedJobAnalysesState();
  if (jobId in computed) {
    delete computed[jobId];
    writeScopedJson("analyses", computed);
  }
}

export function updateUserJob(
  jobId: string,
  updates: Pick<JobPosting, "title" | "company" | "location" | "description"> & {
    sourceUrl?: string;
  },
): boolean {
  if (!isBrowser()) return false;
  const existing = readStoredJobRecords();
  const now = new Date().toISOString();
  let changed = false;
  const next = existing.map((record) => {
    if (record.id !== jobId) return record;
    const updated: StoredJobRecord = {
      ...record,
      title: updates.title,
      company: updates.company,
      location: updates.location,
      description: updates.description,
      sourceUrl: updates.sourceUrl ?? record.sourceUrl,
      updatedAt: now,
      latestAnalysisRef: undefined,
    };
    changed =
      record.title !== updated.title ||
      record.company !== updated.company ||
      record.location !== updated.location ||
      record.description !== updated.description ||
      record.sourceUrl !== updated.sourceUrl;
    return updated;
  });
  if (!changed) return false;
  writeStoredJobRecords(next);
  clearJobAnalysisState(jobId);
  dispatchJobWorkspaceChanged();
  return true;
}

/** Hide a job from the workspace (user-added or demo/sample) and clear related state. */
export function removeJobFromWorkspace(jobId: string): void {
  if (!isBrowser()) return;

  const existing = readStoredJobRecords();
  if (existing.some((job) => job.id === jobId)) {
    writeStoredJobRecords(existing.filter((job) => job.id !== jobId));
  }

  addRemovedJobId(jobId);
  clearJobAnalysisState(jobId);
  clearJobPipelineState(jobId);

  if (getSelectedJobId() === jobId) {
    clearSelectedJobId();
  }
  if (getPendingAnalysisJobId() === jobId) {
    clearPendingAnalysisJobId();
  }

  dispatchJobWorkspaceChanged();
}

export function deleteUserJob(jobId: string): void {
  removeJobFromWorkspace(jobId);
}

/** Remove all alpha-scoped user jobs and their analysis records. Returns count removed. */
export function clearAllUserJobs(): number {
  if (!isBrowser()) return 0;
  const userJobs = getStoredUserJobs();
  if (userJobs.length === 0) return 0;

  for (const job of userJobs) {
    clearJobAnalysisState(job.id);
    clearJobPipelineState(job.id);
  }
  writeStoredJobRecords([]);

  const selectedId = getSelectedJobId();
  if (selectedId && userJobs.some((job) => job.id === selectedId)) {
    clearSelectedJobId();
  }

  dispatchJobWorkspaceChanged();
  return userJobs.length;
}

export type {
  ResumePersistenceState,
  StoredResumeInput,
  StoredResumeRecord,
  StoredResumeUploadState,
} from "@/lib/resume-store";

export {
  clearStoredResume,
  clearStoredResumeUploadState,
  createResume,
  duplicateResume,
  getActiveResumeId,
  getActiveResumeLabel,
  getActiveResumeRecord,
  getAllResumeRecords,
  getResumeParsedAt,
  getResumePersistenceState,
  getResumeSavedAt,
  getResumeWorkspaceSnapshot,
  getStoredResumeInput,
  getStoredResumeUploadState,
  hasStoredResumeInput,
  isResumeReadyForAnalysis,
  markResumeParsed,
  removeResume,
  renameResume,
  RESUME_STORAGE_CHANGED_EVENT,
  saveStoredResumeDraft,
  saveStoredResumeInput,
  saveStoredResumeUploadState,
  setActiveResume,
  setActiveResumeId,
} from "@/lib/resume-store";

const EMPTY_PROFILE: ProfileData = {
  fullName: "",
  location: "",
  workPermit: "",
  languages: [],
  desiredIndustries: [],
  desiredRoles: [],
  activeResumeId: "",
};

export function getStoredProfile(): ProfileData {
  if (!isBrowser()) return { ...EMPTY_PROFILE };
  const parsed = readScopedJson<Partial<ProfileData>>("profile");
  if (!parsed) return { ...EMPTY_PROFILE };
  return {
    fullName: typeof parsed.fullName === "string" ? parsed.fullName : "",
    location: typeof parsed.location === "string" ? parsed.location : "",
    workPermit: typeof parsed.workPermit === "string" ? parsed.workPermit : "",
    languages: Array.isArray(parsed.languages)
      ? parsed.languages.filter((item): item is string => typeof item === "string")
      : [],
    desiredIndustries: Array.isArray(parsed.desiredIndustries)
      ? parsed.desiredIndustries.filter((item): item is string => typeof item === "string")
      : [],
    desiredRoles: Array.isArray(parsed.desiredRoles)
      ? parsed.desiredRoles.filter((item): item is string => typeof item === "string")
      : [],
    activeResumeId: typeof parsed.activeResumeId === "string" ? parsed.activeResumeId : "",
  };
}

export function saveStoredProfile(profile: ProfileData): void {
  if (!isBrowser()) return;
  writeScopedJson("profile", {
    fullName: profile.fullName.trim(),
    location: profile.location.trim(),
    workPermit: profile.workPermit.trim(),
    languages: profile.languages.map((item) => item.trim()).filter((item) => item.length > 0),
    desiredIndustries: profile.desiredIndustries
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    desiredRoles: profile.desiredRoles.map((item) => item.trim()).filter((item) => item.length > 0),
    activeResumeId: profile.activeResumeId.trim(),
  });
}
