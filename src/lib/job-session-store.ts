import type { FitCategory, JobAnalysis, JobPosting } from "@/types/coach";

const USER_JOBS_STORAGE_KEY = "career-coach.user-jobs";
const SELECTED_JOB_STORAGE_KEY = "career-coach.selected-job-id";
const ANALYZED_JOBS_STORAGE_KEY = "career-coach.analyzed-jobs";
const COMPUTED_ANALYSES_STORAGE_KEY = "career-coach.computed-analyses";

export type AnalyzedJobsState = Record<string, boolean>;
export type ComputedAnalysisState = "ready" | "insufficient_evidence";
export type ComputedJobAnalysis = JobAnalysis & {
  analysisState: ComputedAnalysisState;
  source: "computed-v1";
  missingEvidence: string[];
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

  return {
    id: job.id.trim(),
    title: normalizedTitle,
    company: normalizedCompany,
    location: job.location ?? "",
    source: normalizedSource,
    salaryRange: job.salaryRange,
    description: normalizedDescription,
    requiredSkills: Array.isArray(job.requiredSkills)
      ? job.requiredSkills.filter((skill): skill is string => typeof skill === "string")
      : [],
  };
}

export function getStoredUserJobs(): JobPosting[] {
  if (!isBrowser()) return [];
  const parsed = parseJson<Partial<JobPosting>[]>(window.localStorage.getItem(USER_JOBS_STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => sanitizeJob(entry))
    .filter((entry): entry is JobPosting => entry !== null);
}

export function saveUserJob(job: JobPosting): void {
  if (!isBrowser()) return;
  const existing = getStoredUserJobs();
  if (existing.some((item) => item.id === job.id)) return;
  window.localStorage.setItem(USER_JOBS_STORAGE_KEY, JSON.stringify([job, ...existing]));
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
  const value = window.localStorage.getItem(SELECTED_JOB_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function setSelectedJobId(jobId: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SELECTED_JOB_STORAGE_KEY, jobId);
}

export function clearSelectedJobId(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SELECTED_JOB_STORAGE_KEY);
}

export function getAnalyzedJobsState(): AnalyzedJobsState {
  if (!isBrowser()) return {};
  const parsed = parseJson<Record<string, unknown>>(
    window.localStorage.getItem(ANALYZED_JOBS_STORAGE_KEY),
  );
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
  window.localStorage.setItem(ANALYZED_JOBS_STORAGE_KEY, JSON.stringify(current));
}

function sanitizeFit(value: unknown): FitCategory | null {
  if (
    value === "Strong Fit" ||
    value === "Backup Fit" ||
    value === "Aspirational Fit" ||
    value === "No Fit"
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
  };
}

export function getComputedJobAnalysesState(): ComputedJobAnalysesState {
  if (!isBrowser()) return {};
  const parsed = parseJson<Record<string, Partial<ComputedJobAnalysis>>>(
    window.localStorage.getItem(COMPUTED_ANALYSES_STORAGE_KEY),
  );
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
  window.localStorage.setItem(COMPUTED_ANALYSES_STORAGE_KEY, JSON.stringify(current));
}

export function clearJobAnalysisState(jobId: string): void {
  if (!isBrowser()) return;
  const analyzed = getAnalyzedJobsState();
  if (jobId in analyzed) {
    delete analyzed[jobId];
    window.localStorage.setItem(ANALYZED_JOBS_STORAGE_KEY, JSON.stringify(analyzed));
  }

  const computed = getComputedJobAnalysesState();
  if (jobId in computed) {
    delete computed[jobId];
    window.localStorage.setItem(COMPUTED_ANALYSES_STORAGE_KEY, JSON.stringify(computed));
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
  window.localStorage.setItem(USER_JOBS_STORAGE_KEY, JSON.stringify(next));
  clearJobAnalysisState(jobId);
  return true;
}

export function deleteUserJob(jobId: string): void {
  if (!isBrowser()) return;

  const existing = getStoredUserJobs();
  const nextJobs = existing.filter((job) => job.id !== jobId);
  window.localStorage.setItem(USER_JOBS_STORAGE_KEY, JSON.stringify(nextJobs));

  clearJobAnalysisState(jobId);

  if (getSelectedJobId() === jobId) {
    clearSelectedJobId();
  }
}
