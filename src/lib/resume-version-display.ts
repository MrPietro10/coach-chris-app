import type { StoredResumeRecord } from "@/lib/resume-store";
import { isJobInWorkspace } from "@/lib/job-session-store";

export const TAILORED_FOR_REMOVED_JOB_NOTICE = "Tailored for a job you removed";

export type ResumeVersionDisplayMeta = {
  name: string;
  sourceFileName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  uploadedAt: string | null;
  uploadedLabel: string | null;
  addedLabel: string | null;
  lastUpdatedLabel: string | null;
  sourceFileLabel: string | null;
};

export function formatResumeTimestamp(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatResumeDateShort(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function getResumeVersionDisplayMeta(record: StoredResumeRecord): ResumeVersionDisplayMeta {
  return getResumeVersionDisplayMetaFromFields({
    name: record.name,
    sourceFileName: record.sourceFileName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    uploadedAt: record.uploadedAt,
  });
}

export function getResumeVersionDisplayMetaFromFields(input: {
  name: string;
  sourceFileName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  uploadedAt?: string | null;
}): ResumeVersionDisplayMeta {
  const sourceFileName = input.sourceFileName?.trim() || null;
  const uploadedAt = input.uploadedAt?.trim() || null;
  const createdAt = input.createdAt?.trim() || null;
  const updatedAt = input.updatedAt?.trim() || null;

  const uploadedFormatted = formatResumeTimestamp(uploadedAt);
  const addedFormatted = formatResumeTimestamp(createdAt);
  const updatedFormatted = formatResumeTimestamp(updatedAt);

  return {
    name: input.name,
    sourceFileName,
    createdAt,
    updatedAt,
    uploadedAt,
    uploadedLabel: uploadedFormatted ? `Uploaded: ${uploadedFormatted}` : null,
    addedLabel: !uploadedFormatted && addedFormatted ? `Added: ${addedFormatted}` : null,
    lastUpdatedLabel: updatedFormatted ? `Last updated: ${updatedFormatted}` : null,
    sourceFileLabel: sourceFileName ? `Source file: ${sourceFileName}` : null,
  };
}

export function formatResumeVersionOptionLabel(record: StoredResumeRecord): string {
  const updatedShort = formatResumeDateShort(record.updatedAt);
  const uploadedShort = formatResumeDateShort(record.uploadedAt);
  const savedSuffix = record.savedAt ? " · saved for analysis" : "";
  const dateSuffix = updatedShort ? ` · updated ${updatedShort}` : "";
  const uploadedSuffix = uploadedShort ? ` · uploaded ${uploadedShort}` : "";
  const tailoredSuffix = record.tailoredForJobId ? " · tailored" : "";
  return `${record.name}${uploadedSuffix}${dateSuffix}${savedSuffix}${tailoredSuffix}`;
}

export type TailoredResumeLinkMeta = {
  jobTitle: string | null;
  company: string | null;
  isRemoved: boolean;
  primaryLabel: string | null;
  removedNotice: typeof TAILORED_FOR_REMOVED_JOB_NOTICE | null;
};

function formatTailoredRoleLabel(jobTitle: string | null, company: string | null): string | null {
  if (jobTitle && company) return `${jobTitle} at ${company}`;
  return jobTitle || company;
}

export function getTailoredResumeLinkMeta(record: StoredResumeRecord): TailoredResumeLinkMeta | null {
  const jobId = record.tailoredForJobId?.trim();
  const jobTitle = record.tailoredForJobTitle?.trim() || null;
  const company = record.tailoredForCompany?.trim() || null;
  if (!jobId && !jobTitle && !company) return null;

  const isRemoved = jobId ? !isJobInWorkspace(jobId) : false;
  const roleLabel = formatTailoredRoleLabel(jobTitle, company);

  return {
    jobTitle,
    company,
    isRemoved,
    primaryLabel: roleLabel ? `Tailored for ${roleLabel}` : null,
    removedNotice: isRemoved ? TAILORED_FOR_REMOVED_JOB_NOTICE : null,
  };
}

export function formatTailoredForLabel(record: StoredResumeRecord): string | null {
  const link = getTailoredResumeLinkMeta(record);
  if (!link) return null;
  if (link.isRemoved) {
    return link.removedNotice;
  }
  return link.primaryLabel;
}

export function getLatestResumeRecord(records: StoredResumeRecord[]): StoredResumeRecord | null {
  if (records.length === 0) return null;
  return [...records].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  )[0];
}

export function getMostRecentlyUploadedResume(
  records: StoredResumeRecord[],
): StoredResumeRecord | null {
  if (records.length === 0) return null;
  return [...records].sort((left, right) => {
    const leftStamp = Date.parse(left.uploadedAt ?? left.createdAt);
    const rightStamp = Date.parse(right.uploadedAt ?? right.createdAt);
    return rightStamp - leftStamp;
  })[0];
}

export type AnalysisResumeOptionMeta = {
  name: string;
  lastUpdatedLabel: string | null;
  uploadedLabel: string | null;
  tailoredForLabel: string | null;
  tailoredJobTitle: string | null;
  tailoredCompany: string | null;
  tailoredJobRemovedNotice: string | null;
  sourceFileLabel: string | null;
  isActive: boolean;
  isMostRecentlyUploaded: boolean;
};

export function getAnalysisResumeOptionMeta(
  record: StoredResumeRecord,
  activeResumeId: string | null,
  options?: { mostRecentlyUploadedId?: string | null },
): AnalysisResumeOptionMeta {
  const display = getResumeVersionDisplayMeta(record);
  const tailoredLink = getTailoredResumeLinkMeta(record);
  const updatedShort = formatResumeDateShort(record.updatedAt);
  const uploadedShort = formatResumeDateShort(record.uploadedAt);

  return {
    name: record.name,
    lastUpdatedLabel: updatedShort ? `Last updated ${updatedShort}` : display.lastUpdatedLabel,
    uploadedLabel: uploadedShort
      ? `Uploaded ${uploadedShort}`
      : display.uploadedLabel,
    tailoredForLabel: tailoredLink?.primaryLabel ?? null,
    tailoredJobTitle: tailoredLink?.jobTitle ?? null,
    tailoredCompany: tailoredLink?.company ?? null,
    tailoredJobRemovedNotice: tailoredLink?.removedNotice ?? null,
    sourceFileLabel: display.sourceFileLabel,
    isActive: record.id === activeResumeId,
    isMostRecentlyUploaded: Boolean(
      options?.mostRecentlyUploadedId && record.id === options.mostRecentlyUploadedId,
    ),
  };
}

export function formatAnalysisResumeOptionSummary(meta: AnalysisResumeOptionMeta): string {
  const parts = [meta.name];
  if (meta.uploadedLabel) parts.push(meta.uploadedLabel);
  if (meta.lastUpdatedLabel) parts.push(meta.lastUpdatedLabel);
  if (meta.tailoredForLabel) parts.push(meta.tailoredForLabel);
  if (meta.tailoredJobRemovedNotice) parts.push(meta.tailoredJobRemovedNotice);
  if (meta.sourceFileLabel) parts.push(meta.sourceFileLabel);
  if (meta.isActive) parts.push("Active resume");
  return parts.join(" · ");
}
