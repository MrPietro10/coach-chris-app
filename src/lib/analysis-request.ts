import type { AnalysisResumeContext } from "@/lib/analysis-resume-context";
import { hasAnalysisResumeContext } from "@/lib/analysis-resume-context";

/** Conservative cap for job description + resume JSON sent to Gemini. */
export const MAX_ANALYSIS_PAYLOAD_CHARS = 120_000;

export type AnalysisRequestValidation =
  | { ok: true; payloadChars: number }
  | { ok: false; code: "missing_inputs" | "payload_too_large"; message: string };

export function estimateAnalysisPayloadChars(input: {
  jobDescription: string;
  resumeContext: AnalysisResumeContext;
  jobTitle?: string;
  jobCompany?: string;
}): number {
  return (
    (input.jobTitle?.length ?? 0) +
    (input.jobCompany?.length ?? 0) +
    input.jobDescription.length +
    input.resumeContext.summary.length +
    input.resumeContext.skills.join("").length +
    input.resumeContext.experienceHighlights.join("").length
  );
}

export function validateAnalysisRequest(input: {
  jobDescription: string;
  resumeContext: AnalysisResumeContext;
  jobTitle?: string;
  jobCompany?: string;
}): AnalysisRequestValidation {
  const hasJobDescription = input.jobDescription.trim().length > 0;
  const hasResume = hasAnalysisResumeContext(input.resumeContext);

  if (!hasJobDescription || !hasResume) {
    return {
      ok: false,
      code: "missing_inputs",
      message: "Add a resume and job description before running analysis.",
    };
  }

  const payloadChars = estimateAnalysisPayloadChars(input);
  if (payloadChars > MAX_ANALYSIS_PAYLOAD_CHARS) {
    return {
      ok: false,
      code: "payload_too_large",
      message:
        "This job post or resume is too long to analyze cleanly. Try shortening the job description.",
    };
  }

  return { ok: true, payloadChars };
}

export function logAnalysisDiagnostic(
  event: string,
  details: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[single-job-analysis] ${event}`, details);
}

export function logAnalysisError(
  event: string,
  error: unknown,
  details: Record<string, unknown>,
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error(`[single-job-analysis] ${event}`, { ...details, error: err });
}

export function safeErrorSnippet(error: unknown, maxLen = 240): string {
  const text = error instanceof Error ? error.message : String(error);
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}
