import type { ComputedJobAnalysesState } from "@/lib/job-session-store";

export type ResumeLastAnalysisUsage = {
  jobTitle: string;
  company: string;
  createdAt: string | null;
};

export function formatLastAnalysisUsageLabel(usage: ResumeLastAnalysisUsage): string {
  const company = usage.company.trim();
  return company ? `${usage.jobTitle} at ${company}` : usage.jobTitle;
}

export function getLastAnalysisUsageForResume(
  resumeId: string,
  analyses: ComputedJobAnalysesState,
): ResumeLastAnalysisUsage | null {
  const matches = Object.values(analyses)
    .filter(
      (analysis) =>
        analysis.resumeVersionId === resumeId &&
        analysis.analysisState === "ready" &&
        typeof analysis.jobTitle === "string" &&
        analysis.jobTitle.trim().length > 0,
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt ?? "") || 0;
      const rightTime = Date.parse(right.createdAt ?? "") || 0;
      return rightTime - leftTime;
    });

  const latest = matches[0];
  if (!latest) return null;

  return {
    jobTitle: latest.jobTitle!.trim(),
    company: latest.company?.trim() || "Unknown company",
    createdAt: latest.createdAt ?? null,
  };
}
