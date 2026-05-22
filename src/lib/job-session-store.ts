import {
  readAlphaScopedStorageItem,
  removeAlphaScopedStorageItem,
  type AlphaScopedStorageResource,
  writeAlphaScopedStorageItem,
} from "@/lib/alpha-scoped-storage";
import type {
  ConfidenceLevel,
  FitCategory,
  JobAnalysis,
  JobPosting,
  ProfileData,
} from "@/types/coach";

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

function isValidSource(value: string): value is JobPosting["source"] {
  return value === "manual_upload" || value === "pasted_text" || value === "pasted_url";
}

function sanitizeJob(job: Partial<JobPosting>): JobPosting | null {
  if (!job.id || typeof job.id !== "string" || job.id.trim().length === 0) {
    return null;
  }

  const fallbackSource: JobPosting["source"] = "pasted_text";
  const normalizedSource =
    typeof job.source === "string" && isValidSource(job.source) ? job.source : fallbackSource;
  const normalizedTitle =
    typeof job.title === "string" && job.title.trim().length > 0
      ? job.title.trim()
      : "Untitled job";
  const normalizedCompany =
    typeof job.company === "string" && job.company.trim().length > 0
      ? job.company.trim()
      : "Unknown company";
  const normalizedDescription =
    typeof job.description === "string" && job.description.trim().length > 0
      ? job.description.trim()
      : "(description not provided)";

  const normalizedJobUrl =
    typeof job.jobUrl === "string" && job.jobUrl.trim().length > 0 ? job.jobUrl.trim() : undefined;

  return {
    id: job.id.trim(),
    title: normalizedTitle,
    company: normalizedCompany,
    location: job.location ?? "",
    source: normalizedSource,
    salaryRange: job.salaryRange,
    jobUrl: normalizedJobUrl,
    description: normalizedDescription,
    requiredSkills: Array.isArray(job.requiredSkills)
      ? job.requiredSkills.filter((skill): skill is string => typeof skill === "string")
      : [],
  };
}

export function getStoredUserJobs(): JobPosting[] {
  if (!isBrowser()) return [];
  const parsed = readScopedJson<Partial<JobPosting>[]>("jobs");
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => sanitizeJob(entry))
    .filter((entry): entry is JobPosting => entry !== null);
}

export function saveUserJob(job: JobPosting): void {
  if (!isBrowser()) return;
  const existing = getStoredUserJobs();
  if (existing.some((item) => item.id === job.id)) return;
  writeScopedJson("jobs", [job, ...existing]);
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
  return sanitizeJob({
    id,
    title: row.title,
    company: row.company,
    location: row.location,
    jobUrl: row.jobUrl,
    description: row.description,
    source: "manual_upload",
    requiredSkills: [],
  });
}

/** Merge spreadsheet rows into alpha-scoped jobs storage (skips invalid rows). */
export function saveImportedUserJobs(rows: SpreadsheetJobImportInput[]): JobPosting[] {
  if (!isBrowser()) return [];
  const existing = getStoredUserJobs();
  const existingIds = new Set(existing.map((job) => job.id));
  const imported: JobPosting[] = [];

  for (const row of rows) {
    const job = jobPostingFromSpreadsheetRow(row);
    if (!job || existingIds.has(job.id)) continue;
    imported.push(job);
    existingIds.add(job.id);
  }

  if (imported.length === 0) return [];
  writeScopedJson("jobs", [...imported, ...existing]);
  return imported;
}

export function getAllStoredJobs(baseJobs: JobPosting[]): JobPosting[] {
  const userJobs = getStoredUserJobs();
  const baseIds = new Set(baseJobs.map((job) => job.id));
  const seenUserIds = new Set<string>();
  const dedupedUserJobs = userJobs.filter((job) => {
    if (baseIds.has(job.id)) return false;
    if (seenUserIds.has(job.id)) return false;
    seenUserIds.add(job.id);
    return true;
  });
  return [...baseJobs, ...dedupedUserJobs];
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
}

export function markPendingAnalysisJobId(jobId: string): void {
  if (!isBrowser()) return;
  writeAlphaScopedStorageItem("pending-analysis-job", jobId);
}

export function getPendingAnalysisJobId(): string | null {
  if (!isBrowser()) return null;
  const value = readAlphaScopedStorageItem("pending-analysis-job");
  return value && value.trim().length > 0 ? value : null;
}

export function clearPendingAnalysisJobId(): void {
  if (!isBrowser()) return;
  removeScoped("pending-analysis-job");
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
  updates: Pick<JobPosting, "title" | "company" | "location" | "description">,
): boolean {
  if (!isBrowser()) return false;
  const existing = getStoredUserJobs();
  const next = existing.map((job) =>
    job.id === jobId
      ? {
          ...job,
          title: updates.title,
          company: updates.company,
          location: updates.location,
          description: updates.description,
        }
      : job,
  );
  const changed = next.some((job, index) => {
    const prev = existing[index];
    return (
      job.id === jobId &&
      prev &&
      (job.title !== prev.title ||
        job.company !== prev.company ||
        job.location !== prev.location ||
        job.description !== prev.description)
    );
  });
  if (!changed) return false;
  writeScopedJson("jobs", next);
  clearJobAnalysisState(jobId);
  return true;
}

export function deleteUserJob(jobId: string): void {
  if (!isBrowser()) return;

  const existing = getStoredUserJobs();
  const nextJobs = existing.filter((job) => job.id !== jobId);
  writeScopedJson("jobs", nextJobs);

  clearJobAnalysisState(jobId);

  if (getSelectedJobId() === jobId) {
    clearSelectedJobId();
  }
}

export type StoredResumeInput = {
  summary: string;
  skills: string;
  highlights: string;
};

export type StoredResumeUploadState = {
  fileName: string;
  uploadedAt: string;
  fileType?: "pdf" | "docx";
};

export type ResumePersistenceState = {
  input: StoredResumeInput;
  upload: StoredResumeUploadState | null;
  savedAt: string | null;
  parsedAt: string | null;
  isSavedForAnalysis: boolean;
  needsParseReview: boolean;
};

export const RESUME_STORAGE_CHANGED_EVENT = "career-coach:resume-storage-changed";

const EMPTY_RESUME_INPUT: StoredResumeInput = {
  summary: "",
  skills: "",
  highlights: "",
};

const EMPTY_RESUME_UPLOAD_STATE: StoredResumeUploadState | null = null;

export function getStoredResumeInput(): StoredResumeInput {
  if (!isBrowser()) return { ...EMPTY_RESUME_INPUT };
  const parsed = readScopedJson<Partial<StoredResumeInput>>("resume");
  if (!parsed) return { ...EMPTY_RESUME_INPUT };
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    skills: typeof parsed.skills === "string" ? parsed.skills : "",
    highlights: typeof parsed.highlights === "string" ? parsed.highlights : "",
  };
}

export function getStoredResumeUploadState(): StoredResumeUploadState | null {
  if (!isBrowser()) return EMPTY_RESUME_UPLOAD_STATE;
  const parsed = readResumeRecordRaw();
  if (!parsed) return EMPTY_RESUME_UPLOAD_STATE;
  const fileName = typeof parsed.uploadFileName === "string" ? parsed.uploadFileName.trim() : "";
  const uploadedAt = typeof parsed.uploadedAt === "string" ? parsed.uploadedAt.trim() : "";
  if (!fileName || !uploadedAt) return EMPTY_RESUME_UPLOAD_STATE;
  const fileTypeRaw = typeof parsed.uploadFileType === "string" ? parsed.uploadFileType : "";
  const fileType = fileTypeRaw === "pdf" || fileTypeRaw === "docx" ? fileTypeRaw : undefined;
  return { fileName, uploadedAt, fileType };
}

export function getResumeSavedAt(): string | null {
  if (!isBrowser()) return null;
  const parsed = readScopedJson<Record<string, unknown>>("resume");
  if (!parsed || typeof parsed !== "object") return null;
  const savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt.trim() : "";
  return savedAt || null;
}

export function getResumeParsedAt(): string | null {
  if (!isBrowser()) return null;
  const parsed = readScopedJson<Record<string, unknown>>("resume");
  if (!parsed || typeof parsed !== "object") return null;
  const parsedAt = typeof parsed.parsedAt === "string" ? parsed.parsedAt.trim() : "";
  return parsedAt || null;
}

export function isResumeReadyForAnalysis(): boolean {
  return hasStoredResumeInput() && Boolean(getResumeSavedAt());
}

export function getResumeWorkspaceSnapshot(draft?: StoredResumeInput): {
  stored: StoredResumeInput;
  draft: StoredResumeInput;
  upload: StoredResumeUploadState | null;
  savedAt: string | null;
  parsedAt: string | null;
} {
  const stored = getStoredResumeInput();
  return {
    stored,
    draft: draft ?? stored,
    upload: getStoredResumeUploadState(),
    savedAt: getResumeSavedAt(),
    parsedAt: getResumeParsedAt(),
  };
}

type ResumeWritePreserve = "preserve";

function dispatchResumeStorageChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(RESUME_STORAGE_CHANGED_EVENT));
}

function readResumeRecordRaw(): Record<string, unknown> | null {
  const parsed = readScopedJson<Record<string, unknown>>("resume");
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function getResumePersistenceState(): ResumePersistenceState {
  const input = getStoredResumeInput();
  const upload = getStoredResumeUploadState();
  const savedAt = getResumeSavedAt();
  const parsedAt = getResumeParsedAt();
  const hasContent = hasStoredResumeInput();

  return {
    input,
    upload,
    savedAt,
    parsedAt,
    isSavedForAnalysis: Boolean(savedAt) && hasContent,
    needsParseReview: Boolean(parsedAt) && !savedAt && hasContent,
  };
}

function writeResumeRecord(
  input: StoredResumeInput,
  options?: {
    savedAt?: string | null | ResumeWritePreserve;
    parsedAt?: string | null | ResumeWritePreserve;
    upload?: StoredResumeUploadState | null | ResumeWritePreserve;
  },
): void {
  const existingRaw = readResumeRecordRaw();
  const existingUpload = getStoredResumeUploadState();
  const uploadState =
    options?.upload === undefined || options.upload === "preserve"
      ? existingUpload
      : options.upload;
  const existingSavedAt = getResumeSavedAt();
  const nextSavedAt =
    options?.savedAt === undefined || options.savedAt === "preserve"
      ? (existingSavedAt ?? "")
      : (options.savedAt ?? "");
  const existingParsedAt = getResumeParsedAt();
  const nextParsedAt =
    options?.parsedAt === undefined || options.parsedAt === "preserve"
      ? (existingParsedAt ?? "")
      : (options.parsedAt ?? "");
  const existingFileType =
    typeof existingRaw?.uploadFileType === "string" ? existingRaw.uploadFileType : "";

  writeScopedJson("resume", {
    summary: input.summary.trim(),
    skills: input.skills.trim(),
    highlights: input.highlights.trim(),
    uploadFileName: uploadState?.fileName ?? "",
    uploadedAt: uploadState?.uploadedAt ?? "",
    uploadFileType: uploadState?.fileType ?? existingFileType,
    savedAt: nextSavedAt,
    parsedAt: nextParsedAt,
  });
  dispatchResumeStorageChanged();
}

/** Persist parsed or edited content without confirming for analysis yet. */
export function saveStoredResumeDraft(input: StoredResumeInput): void {
  if (!isBrowser()) return;
  writeResumeRecord(input, { savedAt: null, parsedAt: "preserve" });
}

export function saveStoredResumeInput(input: StoredResumeInput): void {
  if (!isBrowser()) return;
  writeResumeRecord(input, {
    savedAt: new Date().toISOString(),
    parsedAt: "preserve",
    upload: "preserve",
  });
}

export function markResumeParsed(
  input: StoredResumeInput,
  options?: { fileType?: "pdf" | "docx"; parsedAt?: string },
): void {
  if (!isBrowser()) return;
  const existingUpload = getStoredResumeUploadState();
  const upload =
    existingUpload && options?.fileType
      ? { ...existingUpload, fileType: options.fileType }
      : existingUpload;
  writeResumeRecord(input, {
    savedAt: null,
    parsedAt: options?.parsedAt ?? new Date().toISOString(),
    upload: upload ?? "preserve",
  });
}

export function saveStoredResumeUploadState(state: StoredResumeUploadState): void {
  if (!isBrowser()) return;
  writeResumeRecord(getStoredResumeInput(), {
    upload: {
      fileName: state.fileName.trim(),
      uploadedAt: state.uploadedAt.trim(),
      fileType: state.fileType,
    },
    savedAt: "preserve",
    parsedAt: "preserve",
  });
}

export function clearStoredResumeUploadState(): void {
  if (!isBrowser()) return;
  writeResumeRecord(getStoredResumeInput(), {
    upload: null,
    savedAt: "preserve",
    parsedAt: "preserve",
  });
}

export function hasStoredResumeInput(): boolean {
  const input = getStoredResumeInput();
  return (
    input.summary.trim().length > 0 ||
    input.skills.trim().length > 0 ||
    input.highlights.trim().length > 0
  );
}

export function getActiveResumeLabel(): string {
  if (!hasStoredResumeInput()) return "Not added";

  const input = getStoredResumeInput();
  const summary = input.summary.trim();
  if (summary.length > 0) {
    return summary.length > 28 ? `${summary.slice(0, 28)}...` : summary;
  }

  return "Resume added";
}

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
