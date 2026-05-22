import type { JobStatus } from "@/types/coach";

/** Ordered stages for pipeline UI (dashboard columns, select options). */
export const PIPELINE_STAGES: JobStatus[] = [
  "Analyzed",
  "Applied",
  "For Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Archived",
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  Analyzed: "Analyzed",
  Applied: "Applied",
  "For Interview": "Interview",
  Offer: "Offer",
  Rejected: "Rejected",
  Withdrawn: "Withdrawn",
  Archived: "Archived",
};

export const JOB_STATUS_SELECT_STYLE: Record<JobStatus, string> = {
  Analyzed: "border-zinc-200 bg-zinc-50 text-zinc-700",
  Applied: "border-blue-200 bg-blue-50 text-blue-700",
  "For Interview": "border-violet-200 bg-violet-50 text-violet-700",
  Offer: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Rejected: "border-rose-200 bg-rose-50 text-rose-800",
  Withdrawn: "border-amber-200 bg-amber-50 text-amber-900",
  Archived: "border-zinc-200 bg-zinc-100 text-zinc-500",
};

export const JOB_STATUS_DOT: Record<JobStatus, string> = {
  Analyzed: "bg-zinc-400",
  Applied: "bg-blue-500",
  "For Interview": "bg-violet-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-rose-500",
  Withdrawn: "bg-amber-500",
  Archived: "bg-zinc-300",
};

export const JOB_STATUS_BAR_ACTIVE: Record<JobStatus, string> = {
  Analyzed: "border-zinc-300 bg-zinc-50 text-zinc-700",
  Applied: "border-blue-200 bg-blue-50 text-blue-700",
  "For Interview": "border-violet-200 bg-violet-50 text-violet-700",
  Offer: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Rejected: "border-rose-200 bg-rose-50 text-rose-800",
  Withdrawn: "border-amber-200 bg-amber-50 text-amber-900",
  Archived: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

export function isJobStatus(value: string): value is JobStatus {
  return PIPELINE_STAGES.includes(value as JobStatus);
}

export function resolveJobStatus(
  jobId: string,
  statuses: Record<string, JobStatus>,
  options?: { hasAnalysis?: boolean },
): JobStatus | null {
  if (statuses[jobId]) return statuses[jobId];
  if (options?.hasAnalysis) return "Analyzed";
  return null;
}
