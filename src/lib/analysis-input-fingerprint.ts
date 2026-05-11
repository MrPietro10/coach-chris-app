import type { AnalysisResumeContext } from "@/lib/analysis-resume-context";

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function buildAnalysisInputFingerprint(input: {
  jobId: string;
  jobDescription: string;
  resumeContext: AnalysisResumeContext;
}): string {
  const normalized = {
    jobId: input.jobId,
    jobDescription: input.jobDescription.trim(),
    summary: input.resumeContext.summary.trim(),
    skills: [...input.resumeContext.skills].map((item) => item.trim()).sort(),
    highlights: [...input.resumeContext.experienceHighlights]
      .map((item) => item.trim())
      .sort(),
  };

  return hashString(JSON.stringify(normalized));
}
