import {
  getAllStoredJobs,
  getPendingAnalysisJobId,
  getSelectedJobId,
  getStoredJobViews,
  markPendingAnalysisJobId,
  markPendingAnalysisResumeId,
  setSelectedJobId,
} from "@/lib/job-session-store";
import type { StoredJobView } from "@/lib/stored-job";
import type { JobPosting } from "@/types/coach";

export const ACTIVE_JOB_CHANGED_EVENT = "career-coach:active-job-changed";

export type ActiveJobSnapshot = {
  activeJobId: string | null;
  analyzingJobId: string | null;
  activeJob: JobPosting | null;
  activeJobView: StoredJobView | null;
  isAnalyzingActiveJob: boolean;
  savedJobCount: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function dispatchActiveJobChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(ACTIVE_JOB_CHANGED_EVENT));
}

export function getActiveJobSnapshot(baseJobs: JobPosting[] = []): ActiveJobSnapshot {
  const activeJobId = getSelectedJobId();
  const analyzingJobId = getPendingAnalysisJobId();
  const allJobs = getAllStoredJobs(baseJobs);
  const views = getStoredJobViews();
  const viewById = new Map(views.map((view) => [view.id, view]));

  const activeJob =
    activeJobId != null ? (allJobs.find((job) => job.id === activeJobId) ?? null) : null;
  const activeJobView = activeJobId != null ? (viewById.get(activeJobId) ?? null) : null;

  return {
    activeJobId,
    analyzingJobId,
    activeJob,
    activeJobView,
    isAnalyzingActiveJob: Boolean(
      activeJobId && analyzingJobId && activeJobId === analyzingJobId,
    ),
    savedJobCount: allJobs.length,
  };
}

/** Set the workspace active job and notify listeners. */
export function setActiveJob(
  jobId: string,
  options?: { analyzeOnOpen?: boolean; analysisResumeId?: string },
): void {
  setSelectedJobId(jobId);
  if (options?.analyzeOnOpen) {
    markPendingAnalysisJobId(jobId);
  }
  if (options?.analysisResumeId) {
    markPendingAnalysisResumeId(options.analysisResumeId);
  }
  dispatchActiveJobChanged();
}

export function clearActiveJobAnalysisIntent(): void {
  dispatchActiveJobChanged();
}

export function activeJobLabel(snapshot: ActiveJobSnapshot): string {
  if (!snapshot.activeJob) return "No active job";
  const { title, company } = snapshot.activeJob;
  return `${title} · ${company}`;
}
