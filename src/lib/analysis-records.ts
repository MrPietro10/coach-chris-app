import type { ComputedJobAnalysesState, ComputedJobAnalysis } from "@/lib/job-session-store";
import { getAllStoredJobs, getComputedJobAnalysesState } from "@/lib/job-session-store";
import { analyses, jobs } from "@/mock-data/career-coach";
import type { JobAnalysis, JobPosting } from "@/types/coach";

export function getReadyAnalysisForJob(
  jobId: string,
  computedAnalyses: ComputedJobAnalysesState,
  staticAnalyses: JobAnalysis[],
): JobAnalysis | undefined {
  const computed = computedAnalyses[jobId];
  if (computed?.analysisState === "ready") return computed;
  return staticAnalyses.find((analysis) => analysis.jobId === jobId);
}

export function getStoredComputedAnalysis(
  jobId: string,
  computedAnalyses: ComputedJobAnalysesState,
): ComputedJobAnalysis | undefined {
  return computedAnalyses[jobId];
}

export function workspaceHasReadyFitAnalysis(
  baseJobs: JobPosting[] = jobs,
  staticAnalyses: JobAnalysis[] = analyses,
): boolean {
  if (typeof window === "undefined") return false;

  const trackedJobs = getAllStoredJobs(baseJobs);
  const computedAnalyses = getComputedJobAnalysesState();

  return trackedJobs.some((job) =>
    Boolean(getReadyAnalysisForJob(job.id, computedAnalyses, staticAnalyses)),
  );
}
