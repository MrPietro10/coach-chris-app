import {
  readAlphaScopedStorageItem,
  removeAlphaScopedStorageItem,
  type AlphaScopedStorageResource,
} from "@/lib/alpha-scoped-storage";
import { writeScopedJson, writeScopedPlainItem } from "@/lib/alpha-scoped-json-write";
import {
  clearAllPendingTailoredDrafts,
  clearPendingTailoredDraftsForJobs,
} from "@/lib/pending-tailored-drafts";
import { removeTailoredResumesForJobs } from "@/lib/resume-store";
import {
  sanitizeAnalysisResumeSnapshot,
  type AnalysisResumeSnapshot,
} from "@/lib/analysis-resume-linkage";
import { clearAllJobPipelineState, clearJobPipelineState, getJobApplicationNotes, getStoredJobStatuses } from "@/lib/job-pipeline-store";
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
import { jobs as defaultWorkspaceJobs } from "@/mock-data/career-coach";

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
  resumeVersionId?: string;
  resumeVersionName?: string;
  jobTitle?: string;
  company?: string;
  candidateName?: string;
  createdAt?: string;
  snapshotCreatedAt?: string;
  resumeSnapshot?: AnalysisResumeSnapshot;
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

function writeStoredJobRecords(records: StoredJobRecord[]): boolean {
  return writeScopedJson("jobs", records);
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
  if (!writeStoredJobRecords([record, ...existing])) {
    return null;
  }
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
  if (!writeStoredJobRecords([...importedRecords, ...existing])) {
    return [];
  }
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

/** Whether a job id is still visible in the workspace (user-added or demo/sample). */
export function isJobInWorkspace(
  jobId: string | null | undefined,
  baseJobs: JobPosting[] = defaultWorkspaceJobs,
): boolean {
  const trimmed = jobId?.trim();
  if (!trimmed) return false;
  return getAllStoredJobs(baseJobs).some((job) => job.id === trimmed);
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
  writeScopedPlainItem("selected-job", jobId);
  if (isBrowser()) {
    window.dispatchEvent(new Event("career-coach:active-job-changed"));
  }
}

export function markPendingAnalysisJobId(jobId: string): void {
  if (!isBrowser()) return;
  writeScopedPlainItem("pending-analysis-job", jobId);
  window.dispatchEvent(new Event("career-coach:active-job-changed"));
}

export function markPendingAnalysisResumeId(resumeId: string): void {
  if (!isBrowser()) return;
  writeScopedPlainItem("pending-analysis-resume-id", resumeId);
}

export function markPendingAnalysisContext(jobId: string, resumeId?: string | null): void {
  markPendingAnalysisJobId(jobId);
  if (resumeId?.trim()) {
    markPendingAnalysisResumeId(resumeId.trim());
  }
}

export function getPendingAnalysisContext(): {
  jobId: string | null;
  resumeId: string | null;
} {
  return {
    jobId: getPendingAnalysisJobId(),
    resumeId: getPendingAnalysisResumeId(),
  };
}

/** Clear pending job + resume only after analysis succeeds or workspace reset. */
export function clearPendingAnalysisContext(): void {
  clearPendingAnalysisJobId();
}

export function getPendingAnalysisResumeId(): string | null {
  if (!isBrowser()) return null;
  const value = readAlphaScopedStorageItem("pending-analysis-resume-id");
  return value && value.trim().length > 0 ? value : null;
}

export function clearPendingAnalysisResumeId(): void {
  if (!isBrowser()) return;
  removeScoped("pending-analysis-resume-id");
}

export function getPendingAnalysisJobId(): string | null {
  if (!isBrowser()) return null;
  const value = readAlphaScopedStorageItem("pending-analysis-job");
  return value && value.trim().length > 0 ? value : null;
}

export function clearPendingAnalysisJobId(): void {
  if (!isBrowser()) return;
  removeScoped("pending-analysis-job");
  clearPendingAnalysisResumeId();
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

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
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
    resumeVersionId:
      typeof raw.resumeVersionId === "string" && raw.resumeVersionId.trim().length > 0
        ? raw.resumeVersionId.trim()
        : undefined,
    resumeVersionName:
      typeof raw.resumeVersionName === "string" && raw.resumeVersionName.trim().length > 0
        ? raw.resumeVersionName.trim()
        : undefined,
    jobTitle:
      typeof raw.jobTitle === "string" && raw.jobTitle.trim().length > 0
        ? raw.jobTitle.trim()
        : undefined,
    company:
      typeof raw.company === "string" && raw.company.trim().length > 0
        ? raw.company.trim()
        : undefined,
    candidateName:
      typeof raw.candidateName === "string" && raw.candidateName.trim().length > 0
        ? raw.candidateName.trim()
        : undefined,
    createdAt: isIsoTimestamp(raw.createdAt) ? raw.createdAt : undefined,
    snapshotCreatedAt: isIsoTimestamp(raw.snapshotCreatedAt)
      ? raw.snapshotCreatedAt
      : isIsoTimestamp(raw.createdAt)
        ? raw.createdAt
        : undefined,
    resumeSnapshot: sanitizeAnalysisResumeSnapshot(raw.resumeSnapshot),
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

export function setComputedJobAnalysis(analysis: ComputedJobAnalysis): boolean {
  if (!isBrowser()) return false;
  const current = getComputedJobAnalysesState();
  current[analysis.jobId] = analysis;
  if (!writeScopedJson("analyses", current)) {
    return false;
  }

  const records = readStoredJobRecords();
  const index = records.findIndex((record) => record.id === analysis.jobId);
  if (index >= 0) {
    records[index] = syncLatestAnalysisRefOnRecord(records[index], analysis);
    writeStoredJobRecords(records);
  }
  return true;
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

function shouldDropStoredAnalysisJobId(
  jobId: string,
  storedJobIds: Set<string>,
  removedJobIds: Set<string>,
): boolean {
  if (removedJobIds.has(jobId)) return true;
  if (jobId.startsWith("job_user_") || jobId.startsWith("job_import_")) {
    return !storedJobIds.has(jobId);
  }
  return false;
}

/** Remove analysis entries for hidden or deleted jobs while preserving active demo analyses. */
export function pruneAnalysesWithoutSavedJobs(): void {
  if (!isBrowser()) return;

  const storedJobIds = new Set(readStoredJobRecords().map((record) => record.id));
  const removedJobIds = getRemovedJobIds();
  const drop = (jobId: string) =>
    shouldDropStoredAnalysisJobId(jobId, storedJobIds, removedJobIds);

  const analyzed = getAnalyzedJobsState();
  let analyzedChanged = false;
  const nextAnalyzed: AnalyzedJobsState = {};
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

  const computed = getComputedJobAnalysesState();
  let computedChanged = false;
  const nextComputed: ComputedJobAnalysesState = {};
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
  if (!writeStoredJobRecords(next)) {
    return false;
  }
  clearJobAnalysisState(jobId);
  dispatchJobWorkspaceChanged();
  return true;
}

export function setStoredJobRequirements(
  jobId: string,
  requirements: {
    hard: string[];
    soft: string[];
    requirementsFingerprint: string;
  },
): boolean {
  if (!isBrowser()) return false;
  const trimmed = jobId.trim();
  if (!trimmed) return false;

  const existing = readStoredJobRecords();
  const now = new Date().toISOString();
  let changed = false;
  const next = existing.map((record) => {
    if (record.id !== trimmed) return record;
    const updated: StoredJobRecord = {
      ...record,
      hardRequirements: requirements.hard,
      softRequirements: requirements.soft,
      requirementsFingerprint: requirements.requirementsFingerprint,
      // Keep requiredSkills in sync with hard requirements for backward compatibility.
      requiredSkills: requirements.hard,
      updatedAt: now,
    };
    changed =
      (record.requirementsFingerprint ?? "") !== requirements.requirementsFingerprint ||
      JSON.stringify(record.hardRequirements ?? []) !== JSON.stringify(requirements.hard) ||
      JSON.stringify(record.softRequirements ?? []) !== JSON.stringify(requirements.soft);
    return updated;
  });

  if (!changed) return false;
  if (!writeStoredJobRecords(next)) return false;
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
  clearPendingTailoredDraftsForJobs([jobId]);

  if (getSelectedJobId() === jobId) {
    clearSelectedJobId();
  }
  if (getPendingAnalysisJobId() === jobId) {
    clearPendingAnalysisJobId();
  }

  dispatchJobWorkspaceChanged();
}

export function deleteUserJob(
  jobId: string,
  options?: { removeLinkedTailoredResumes?: boolean },
): void {
  if (options?.removeLinkedTailoredResumes) {
    removeTailoredResumesForJobs([jobId]);
  }
  removeJobFromWorkspace(jobId);
}

/** Remove all alpha-scoped user jobs and their analysis records. Returns count removed. */
export function clearAllUserJobs(options?: { removeLinkedTailoredResumes?: boolean }): number {
  if (!isBrowser()) return 0;
  const userJobs = getStoredUserJobs();
  if (userJobs.length === 0) return 0;

  const userJobIds = userJobs.map((job) => job.id);
  for (const job of userJobs) {
    clearJobAnalysisState(job.id);
    clearJobPipelineState(job.id);
  }
  clearPendingTailoredDraftsForJobs(userJobIds);
  if (options?.removeLinkedTailoredResumes) {
    removeTailoredResumesForJobs(userJobIds);
  }
  writeStoredJobRecords([]);
  pruneAnalysesWithoutSavedJobs();

  const selectedId = getSelectedJobId();
  if (selectedId && userJobs.some((job) => job.id === selectedId)) {
    clearSelectedJobId();
  }

  const pendingJobId = getPendingAnalysisJobId();
  if (pendingJobId && userJobs.some((job) => job.id === pendingJobId)) {
    clearPendingAnalysisJobId();
  }

  dispatchJobWorkspaceChanged();
  return userJobs.length;
}

/** Clear every job from the workspace view, including demo roles, analysis, and pipeline state. */
export function clearAllJobsFromWorkspace(
  baseJobs: JobPosting[] = defaultWorkspaceJobs,
  options?: { removeLinkedTailoredResumes?: boolean },
): number {
  if (!isBrowser()) return 0;

  const visibleJobs = getAllStoredJobs(baseJobs);
  const count = visibleJobs.length;
  if (count === 0) return 0;

  const visibleJobIds = visibleJobs.map((job) => job.id);

  writeStoredJobRecords([]);

  const removed = getRemovedJobIds();
  for (const job of baseJobs) {
    removed.add(job.id);
  }
  for (const job of visibleJobs) {
    removed.add(job.id);
  }
  writeScopedJson("removed-jobs", [...removed]);

  writeScopedJson("analyses", {});
  writeScopedJson("analyzed-jobs", {});
  clearAllJobPipelineState();
  clearAllPendingTailoredDrafts();
  if (options?.removeLinkedTailoredResumes) {
    removeTailoredResumesForJobs(visibleJobIds);
  }
  pruneAnalysesWithoutSavedJobs();

  clearSelectedJobId();
  clearPendingAnalysisJobId();
  dispatchJobWorkspaceChanged();
  window.dispatchEvent(new Event("career-coach:active-job-changed"));

  return count;
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
  createResumeVersionFromInput,
  confirmUploadedResumeVersion,
  createTailoredResumeVersion,
  duplicateResume,
  getActiveResumeId,
  getActiveResumeLabel,
  getActiveResumeRecord,
  getAllResumeRecords,
  getLatestTailoredResumeForJob,
  getResumeParsedAt,
  removeTailoredResumesForJobs,
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
