import { readAlphaScopedStorageItem } from "@/lib/alpha-scoped-storage";
import { writeScopedJson } from "@/lib/alpha-scoped-json-write";
import { isJobStatus, PIPELINE_STAGES } from "@/lib/job-pipeline";
import type { JobStatus, JobStatusMap } from "@/types/coach";

export const JOB_PIPELINE_UPDATED_EVENT = "career-coach:job-pipeline-updated";

export type JobStatusTimestampMap = Record<string, string>;
export type JobApplicationNotesMap = Record<string, string>;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function dispatchPipelineUpdated(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(JOB_PIPELINE_UPDATED_EVENT));
}

function parseJsonRecord(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function getStoredJobStatuses(): JobStatusMap {
  if (!isBrowser()) return {};
  const parsed = parseJsonRecord(readAlphaScopedStorageItem("job-statuses"));
  const sanitized: JobStatusMap = {};
  for (const [jobId, status] of Object.entries(parsed)) {
    if (isJobStatus(status)) {
      sanitized[jobId] = status;
    }
  }
  return sanitized;
}

export function saveJobStatuses(statuses: JobStatusMap): void {
  if (!isBrowser()) return;
  writeScopedJson("job-statuses", statuses);
  dispatchPipelineUpdated();
}

export function getStoredJobStatusTimestamps(): JobStatusTimestampMap {
  if (!isBrowser()) return {};
  const parsed = parseJsonRecord(readAlphaScopedStorageItem("job-status-timestamps"));
  const out: JobStatusTimestampMap = {};
  for (const [jobId, value] of Object.entries(parsed)) {
    if (value.trim().length > 0) out[jobId] = value;
  }
  return out;
}

export function saveJobStatusTimestamps(timestamps: JobStatusTimestampMap): void {
  if (!isBrowser()) return;
  writeScopedJson("job-status-timestamps", timestamps);
  dispatchPipelineUpdated();
}

export function setStoredJobStatus(jobId: string, status: JobStatus): void {
  const statuses = getStoredJobStatuses();
  statuses[jobId] = status;
  saveJobStatuses(statuses);

  const timestamps = getStoredJobStatusTimestamps();
  timestamps[jobId] = new Date().toISOString();
  saveJobStatusTimestamps(timestamps);
}

export function getJobApplicationNotes(): JobApplicationNotesMap {
  if (!isBrowser()) return {};
  const parsed = parseJsonRecord(readAlphaScopedStorageItem("job-application-notes"));
  const out: JobApplicationNotesMap = {};
  for (const [jobId, note] of Object.entries(parsed)) {
    if (typeof note === "string") {
      out[jobId] = note;
    }
  }
  return out;
}

export function getJobApplicationNote(jobId: string): string {
  return getJobApplicationNotes()[jobId] ?? "";
}

export function clearJobPipelineState(jobId: string): void {
  if (!isBrowser()) return;

  const statuses = getStoredJobStatuses();
  if (jobId in statuses) {
    delete statuses[jobId];
    saveJobStatuses(statuses);
  }

  const timestamps = getStoredJobStatusTimestamps();
  if (jobId in timestamps) {
    delete timestamps[jobId];
    saveJobStatusTimestamps(timestamps);
  }

  const notes = getJobApplicationNotes();
  if (jobId in notes) {
    delete notes[jobId];
    writeScopedJson("job-application-notes", notes);
    dispatchPipelineUpdated();
  }
}

export function clearAllJobPipelineState(): void {
  if (!isBrowser()) return;
  writeScopedJson("job-statuses", {});
  writeScopedJson("job-status-timestamps", {});
  writeScopedJson("job-application-notes", {});
  dispatchPipelineUpdated();
}

export function setJobApplicationNote(jobId: string, note: string): void {
  if (!isBrowser()) return;
  const notes = getJobApplicationNotes();
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    delete notes[jobId];
  } else {
    notes[jobId] = trimmed;
  }
  writeScopedJson("job-application-notes", notes);
  dispatchPipelineUpdated();
}

export function getPipelineStageCounts(
  jobIds: string[],
  statuses: JobStatusMap,
  options?: { defaultStatus?: JobStatus },
): Record<JobStatus, number> {
  const counts = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<
    JobStatus,
    number
  >;

  for (const jobId of jobIds) {
    const status = statuses[jobId] ?? options?.defaultStatus;
    if (status && counts[status] !== undefined) {
      counts[status] += 1;
    }
  }

  return counts;
}
