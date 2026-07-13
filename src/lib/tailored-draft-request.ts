import type { AnalysisResumeContext } from "@/lib/analysis-resume-context";
import { estimateResumeTextLength } from "@/lib/analysis-request";
import { messageForTailoredDraftFailureCode } from "@/lib/tailored-draft-flow-messages";
import type { TailoredDraftFailureCode } from "@/lib/tailored-draft-flow-messages";
import { hasAnalysisResumeContext } from "@/lib/analysis-resume-context";

export const MAX_TAILORED_DRAFT_PAYLOAD_CHARS = 120_000;

export type TailoredDraftRequestValidation =
  | { ok: true; payloadChars: number }
  | { ok: false; code: TailoredDraftFailureCode; message: string };

export function estimateTailoredDraftPayloadChars(input: {
  jobDescription: string;
  resumeContext: AnalysisResumeContext;
  jobTitle?: string;
  jobCompany?: string;
}): number {
  return (
    (input.jobTitle?.length ?? 0) +
    (input.jobCompany?.length ?? 0) +
    input.jobDescription.length +
    estimateResumeTextLength(input.resumeContext) +
    2_000
  );
}

export function validateTailoredDraftRequest(input: {
  jobDescription: string;
  resumeContext: AnalysisResumeContext;
  jobTitle?: string;
  jobCompany?: string;
}): TailoredDraftRequestValidation {
  const hasJobDescription = input.jobDescription.trim().length > 0;
  const hasResume = hasAnalysisResumeContext(input.resumeContext);

  if (!hasJobDescription) {
    const mapped = messageForTailoredDraftFailureCode("missing_job");
    return { ok: false, code: "missing_job", message: mapped.message };
  }

  if (!hasResume) {
    const mapped = messageForTailoredDraftFailureCode("missing_resume");
    return { ok: false, code: "missing_resume", message: mapped.message };
  }

  const payloadChars = estimateTailoredDraftPayloadChars(input);
  if (payloadChars > MAX_TAILORED_DRAFT_PAYLOAD_CHARS) {
    const mapped = messageForTailoredDraftFailureCode("prompt_too_large");
    return { ok: false, code: "prompt_too_large", message: mapped.message };
  }

  return { ok: true, payloadChars };
}

export function logTailoredDraftDiagnostic(
  event: string,
  details: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[tailored-resume-draft] ${event}`, details);
}

export function logTailoredDraftError(
  event: string,
  error: unknown,
  details: Record<string, unknown>,
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error(`[tailored-resume-draft] ${event}`, { ...details, error: err });
}

export function safeTailoredDraftErrorSnippet(error: unknown, maxLen = 240): string {
  const text = error instanceof Error ? error.message : String(error);
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}
