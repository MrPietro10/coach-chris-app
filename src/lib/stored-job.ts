import type { ComputedJobAnalysis } from "@/lib/job-session-store";
import type { FitCategory, JobPosting, JobSource, JobStatus } from "@/types/coach";

/** Persisted job record in alpha-scoped `jobs` storage. */
export type StoredJobRecord = {
  id: string;
  title: string;
  company: string;
  location: string;
  sourceUrl?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  source: JobSource;
  salaryRange?: string;
  requiredSkills: string[];
  hardRequirements?: string[];
  softRequirements?: string[];
  requirementsFingerprint?: string;
  latestAnalysisRef?: LatestAnalysisReference;
};

export type LatestAnalysisReference = {
  analysisState: "ready" | "insufficient_evidence";
  fit?: FitCategory;
  score?: number;
  updatedAt: string;
};

/** Aggregated view for UI — joins pipeline + notes from their stores. */
export type StoredJobView = StoredJobRecord & {
  pipelineStatus: JobStatus | null;
  notes: string;
};

export type SaveUserJobInput = {
  job: JobPosting;
  sourceUrl?: string;
};

function isValidSource(value: string): value is JobSource {
  return value === "manual_upload" || value === "pasted_text" || value === "pasted_url";
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
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

function sanitizeLatestAnalysisRef(
  raw: unknown,
): LatestAnalysisReference | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const entry = raw as Partial<LatestAnalysisReference>;
  const analysisState =
    entry.analysisState === "insufficient_evidence" ? "insufficient_evidence" : "ready";
  const fit = sanitizeFit(entry.fit);
  const score = typeof entry.score === "number" ? Math.round(entry.score) : undefined;
  const updatedAt = isIsoTimestamp(entry.updatedAt) ? entry.updatedAt : undefined;
  if (!updatedAt) return undefined;
  return {
    analysisState,
    fit: fit ?? undefined,
    score,
    updatedAt,
  };
}

export function sanitizeStoredJobRecord(job: Partial<StoredJobRecord>): StoredJobRecord | null {
  if (!job.id || typeof job.id !== "string" || job.id.trim().length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  const fallbackSource: JobSource = "pasted_text";
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

  const legacyUrl =
    typeof (job as { jobUrl?: string }).jobUrl === "string"
      ? (job as { jobUrl?: string }).jobUrl?.trim()
      : "";
  const sourceUrl =
    typeof job.sourceUrl === "string" && job.sourceUrl.trim().length > 0
      ? job.sourceUrl.trim()
      : legacyUrl || undefined;

  const createdAt = isIsoTimestamp(job.createdAt) ? job.createdAt : now;
  const updatedAt = isIsoTimestamp(job.updatedAt) ? job.updatedAt : createdAt;

  return {
    id: job.id.trim(),
    title: normalizedTitle,
    company: normalizedCompany,
    location: typeof job.location === "string" ? job.location : "",
    sourceUrl,
    description: normalizedDescription,
    createdAt,
    updatedAt,
    source: normalizedSource,
    salaryRange:
      typeof job.salaryRange === "string" && job.salaryRange.trim().length > 0
        ? job.salaryRange.trim()
        : undefined,
    requiredSkills: Array.isArray(job.requiredSkills)
      ? job.requiredSkills.filter((skill): skill is string => typeof skill === "string")
      : [],
    hardRequirements: Array.isArray(job.hardRequirements)
      ? job.hardRequirements.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : undefined,
    softRequirements: Array.isArray(job.softRequirements)
      ? job.softRequirements.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : undefined,
    requirementsFingerprint:
      typeof job.requirementsFingerprint === "string" && job.requirementsFingerprint.trim().length > 0
        ? job.requirementsFingerprint.trim()
        : undefined,
    latestAnalysisRef: sanitizeLatestAnalysisRef(job.latestAnalysisRef),
  };
}

export function storedJobToJobPosting(record: StoredJobRecord): JobPosting {
  return {
    id: record.id,
    title: record.title,
    company: record.company,
    location: record.location,
    source: record.source,
    salaryRange: record.salaryRange,
    jobUrl: record.sourceUrl,
    description: record.description,
    requiredSkills: record.requiredSkills,
    hardRequirements: record.hardRequirements,
    softRequirements: record.softRequirements,
    requirementsFingerprint: record.requirementsFingerprint,
  };
}

export function jobPostingToStoredRecord(
  job: JobPosting,
  options?: { sourceUrl?: string; createdAt?: string; updatedAt?: string },
): StoredJobRecord {
  const now = new Date().toISOString();
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    sourceUrl: options?.sourceUrl ?? job.jobUrl,
    description: job.description,
    createdAt: options?.createdAt ?? now,
    updatedAt: options?.updatedAt ?? now,
    source: job.source,
    salaryRange: job.salaryRange,
    requiredSkills: job.requiredSkills,
    hardRequirements: job.hardRequirements,
    softRequirements: job.softRequirements,
    requirementsFingerprint: job.requirementsFingerprint,
  };
}

export function buildLatestAnalysisRef(
  analysis: ComputedJobAnalysis,
): LatestAnalysisReference {
  return {
    analysisState: analysis.analysisState,
    fit: analysis.analysisState === "ready" ? analysis.fit : undefined,
    score: analysis.analysisState === "ready" ? analysis.score : undefined,
    updatedAt: new Date().toISOString(),
  };
}
