import type { AnalysisFailureCode } from "@/lib/analysis-flow-messages";
import { messageForAnalysisFailureCode } from "@/lib/analysis-flow-messages";
import type { AnalysisResumeContext } from "@/lib/analysis-resume-context";
import { hasAnalysisResumeContext } from "@/lib/analysis-resume-context";

/** Conservative cap for job description + resume JSON sent to Gemini. */
export const MAX_ANALYSIS_PAYLOAD_CHARS = 120_000;

export type AnalysisRequestValidation =
  | { ok: true; payloadChars: number }
  | { ok: false; code: AnalysisFailureCode; message: string };

export function estimateResumeTextLength(resumeContext: AnalysisResumeContext): number {
  return (
    resumeContext.summary.length +
    resumeContext.skills.join("").length +
    resumeContext.experienceHighlights.join("").length +
    resumeContext.educationEntries.join("").length
  );
}

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
    estimateResumeTextLength(input.resumeContext)
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

  if (!hasJobDescription && !hasResume) {
    const mapped = messageForAnalysisFailureCode("invalid_payload");
    return { ok: false, code: "invalid_payload", message: mapped.message };
  }

  if (!hasJobDescription) {
    const mapped = messageForAnalysisFailureCode("missing_job");
    return { ok: false, code: "missing_job", message: mapped.message };
  }

  if (!hasResume) {
    const mapped = messageForAnalysisFailureCode("missing_resume");
    return { ok: false, code: "missing_resume", message: mapped.message };
  }

  const payloadChars = estimateAnalysisPayloadChars(input);
  if (payloadChars > MAX_ANALYSIS_PAYLOAD_CHARS) {
    const mapped = messageForAnalysisFailureCode("prompt_too_large");
    return { ok: false, code: "prompt_too_large", message: mapped.message };
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

export function logAnalysisRetryDiagnostic(details: {
  phase: string;
  pendingJobId: string | null;
  pendingResumeId: string | null;
  retryJobId?: string | null;
  retryResumeId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}): void {
  logAnalysisDiagnostic("retry_context", details);
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
