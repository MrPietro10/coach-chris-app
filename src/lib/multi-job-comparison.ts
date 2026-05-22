import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import type { ComputedJobAnalysesState, ComputedJobAnalysis } from "@/lib/job-session-store";
import type { ConfidenceLevel, FitCategory, JobAnalysis, JobPosting } from "@/types/coach";
import { getStoredOrInferredConfidence } from "@/utils/fit";

export type JobRankingBucket =
  | "best_immediate_fit"
  | "needs_resume_tailoring"
  | "stretch_opportunity";

export const JOB_RANKING_LABELS: Record<JobRankingBucket, string> = {
  best_immediate_fit: "Best immediate fit",
  needs_resume_tailoring: "Needs resume tailoring",
  stretch_opportunity: "Stretch opportunity",
};

export type JobComparisonRow = {
  jobId: string;
  title: string;
  company: string;
  location: string;
  fit: FitCategory | null;
  score: number | null;
  evidenceStrength: ConfidenceLevel | null;
  topGap: string;
  topPriorityNextStep: string;
  ranking: JobRankingBucket | null;
  status: "ready" | "insufficient_evidence" | "not_analyzed" | "failed";
  statusMessage?: string;
};

export function classifyJobRanking(input: {
  fit: FitCategory;
  score: number;
  evidenceStrength: ConfidenceLevel;
  gapCount: number;
}): JobRankingBucket {
  if (input.fit === "Aspirational Fit") {
    return "stretch_opportunity";
  }

  if (
    input.fit === "Low Fit" ||
    input.evidenceStrength === "Low" ||
    input.gapCount >= 3
  ) {
    return "needs_resume_tailoring";
  }

  if (input.fit === "Strong Fit" && input.score >= 60) {
    return "best_immediate_fit";
  }

  if (
    input.fit === "Backup Fit" &&
    input.evidenceStrength === "High" &&
    input.score >= 55
  ) {
    return "best_immediate_fit";
  }

  if (input.fit === "Backup Fit" || input.score < 55) {
    return "stretch_opportunity";
  }

  return "needs_resume_tailoring";
}

export function buildJobComparisonRow(options: {
  job: JobPosting;
  analysis?: JobAnalysis;
  computed?: ComputedJobAnalysis;
  resumeCompleteness: number;
  status?: JobComparisonRow["status"];
  statusMessage?: string;
}): JobComparisonRow {
  const { job, analysis, computed, resumeCompleteness } = options;
  const status = options.status ?? (analysis ? (computed?.analysisState === "insufficient_evidence" ? "insufficient_evidence" : "ready") : "not_analyzed");

  if (!analysis || status === "not_analyzed" || status === "failed") {
    return {
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      fit: null,
      score: null,
      evidenceStrength: null,
      topGap: "—",
      topPriorityNextStep: "Run analysis to compare this role.",
      ranking: null,
      status: status === "failed" ? "failed" : "not_analyzed",
      statusMessage: options.statusMessage,
    };
  }

  const evidenceStrength = getStoredOrInferredConfidence({
    storedConfidence: computed?.confidenceLevel,
    resumeCompleteness,
    missingEvidenceCount: computed?.missingEvidence.length ?? 0,
    keyRequirementEvidenceCount: analysis.strengths.length,
    evidenceItems: analysis.strengths,
  });

  const topGap = analysis.gaps[0]?.trim() || "No major gap surfaced.";
  const topPriorityNextStep =
    analysis.suggestedEdits[0]?.trim() ||
    analysis.gaps[0]?.trim() ||
    "Review fit results for next steps.";

  const ranking =
    status === "ready"
      ? classifyJobRanking({
          fit: analysis.fit,
          score: analysis.score,
          evidenceStrength,
          gapCount: analysis.gaps.length,
        })
      : null;

  return {
    jobId: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    fit: analysis.fit,
    score: analysis.score,
    evidenceStrength,
    topGap,
    topPriorityNextStep,
    ranking,
    status: status === "insufficient_evidence" ? "insufficient_evidence" : "ready",
    statusMessage: options.statusMessage,
  };
}

export function buildComparisonRowsFromState(options: {
  jobs: JobPosting[];
  computedAnalyses: ComputedJobAnalysesState;
  staticAnalyses: JobAnalysis[];
  resumeCompleteness: number;
  failedJobIds?: Record<string, string>;
}): JobComparisonRow[] {
  return options.jobs.map((job) => {
    const computed = options.computedAnalyses[job.id];
    const analysis = getReadyAnalysisForJob(job.id, options.computedAnalyses, options.staticAnalyses);
    const failMessage = options.failedJobIds?.[job.id];
    if (failMessage) {
      return buildJobComparisonRow({
        job,
        resumeCompleteness: options.resumeCompleteness,
        status: "failed",
        statusMessage: failMessage,
      });
    }
    return buildJobComparisonRow({
      job,
      analysis,
      computed,
      resumeCompleteness: options.resumeCompleteness,
    });
  });
}

export function groupRowsByRanking(rows: JobComparisonRow[]): Record<JobRankingBucket, JobComparisonRow[]> {
  const groups: Record<JobRankingBucket, JobComparisonRow[]> = {
    best_immediate_fit: [],
    needs_resume_tailoring: [],
    stretch_opportunity: [],
  };

  for (const row of rows) {
    if (!row.ranking || row.status !== "ready") continue;
    groups[row.ranking].push(row);
  }

  for (const bucket of Object.keys(groups) as JobRankingBucket[]) {
    groups[bucket].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  return groups;
}

export const MAX_MULTI_JOB_COMPARE = 8;
export const MIN_MULTI_JOB_COMPARE = 2;
