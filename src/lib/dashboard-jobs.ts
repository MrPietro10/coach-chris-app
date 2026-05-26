import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import type { ComputedJobAnalysesState } from "@/lib/job-session-store";
import { getStoredJobViews, type StoredJobView } from "@/lib/job-session-store";
import { getStoredJobStatusTimestamps } from "@/lib/job-pipeline-store";
import { resolveJobStatus } from "@/lib/job-pipeline";
import type { JobAnalysis, JobPosting, JobStatus } from "@/types/coach";

export type DashboardJobEntry = {
  job: JobPosting;
  view: StoredJobView | null;
  pipelineStatus: JobStatus | null;
  hasReadyAnalysis: boolean;
  analysis: JobAnalysis | undefined;
  lastUpdatedAt: string;
  notesPreview: string;
};

function resolveLastUpdatedAt(
  jobId: string,
  view: StoredJobView | null,
  statusTimestamps: Record<string, string>,
): string {
  const candidates = [
    view?.latestAnalysisRef?.updatedAt,
    view?.updatedAt,
    statusTimestamps[jobId],
    view?.createdAt,
  ].filter((value): value is string => Boolean(value && !Number.isNaN(Date.parse(value))));

  if (candidates.length === 0) return new Date().toISOString();
  return candidates.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

export function buildDashboardJobEntries(options: {
  trackedJobs: JobPosting[];
  computedAnalyses: ComputedJobAnalysesState;
  staticAnalyses: JobAnalysis[];
  statuses: Record<string, JobStatus>;
}): DashboardJobEntry[] {
  const { trackedJobs, computedAnalyses, staticAnalyses, statuses } = options;
  const views = getStoredJobViews();
  const viewById = new Map(views.map((view) => [view.id, view]));
  const statusTimestamps = getStoredJobStatusTimestamps();

  return trackedJobs.map((job) => {
    const view = viewById.get(job.id) ?? null;
    const analysis = getReadyAnalysisForJob(job.id, computedAnalyses, staticAnalyses);
    const computed = computedAnalyses[job.id];
    const hasReadyAnalysis = Boolean(analysis);
    const hasAnalysisSignal =
      hasReadyAnalysis ||
      computed?.analysisState === "insufficient_evidence" ||
      Boolean(view?.latestAnalysisRef);

    return {
      job,
      view,
      pipelineStatus: resolveJobStatus(job.id, statuses, { hasAnalysis: hasAnalysisSignal }),
      hasReadyAnalysis,
      analysis,
      lastUpdatedAt: resolveLastUpdatedAt(job.id, view, statusTimestamps),
      notesPreview: view?.notes?.trim() ?? "",
    };
  });
}

export function sortByLastUpdated(entries: DashboardJobEntry[]): DashboardJobEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt));
}

export function getRecentlyAnalyzedEntries(
  entries: DashboardJobEntry[],
  limit = 4,
): DashboardJobEntry[] {
  return sortByLastUpdated(entries.filter((entry) => entry.hasReadyAnalysis)).slice(0, limit);
}

export function formatJobLastUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
