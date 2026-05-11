import type { ComputedJobAnalysesState, ComputedJobAnalysis } from "@/lib/job-session-store";
import type { JobAnalysis } from "@/types/coach";

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
