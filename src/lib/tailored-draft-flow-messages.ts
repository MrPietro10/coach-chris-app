import {
  classifyAnalysisFailure,
  looksLikeRawTechnicalError,
  normalizeAnalysisFailureCode,
} from "@/lib/analysis-flow-messages";

export const TAILORED_DRAFT_TEMPORARY_FAILURE_MESSAGE =
  "Coach Chris is temporarily busy. Please try again in a moment.";

export const TAILORED_DRAFT_GENERIC_RETRY_MESSAGE =
  "Could not draft a tailored resume right now. Please try again in a moment.";

export const TAILORED_DRAFT_MISSING_RESUME_MESSAGE =
  "Add or save resume content before drafting a tailored version.";

export const TAILORED_DRAFT_MISSING_JOB_MESSAGE =
  "A job description is required before drafting a tailored resume.";

export const TAILORED_DRAFT_PROMPT_TOO_LARGE_MESSAGE =
  "This resume or job description is too long to draft cleanly. Try shortening the job post.";

export const TAILORED_DRAFT_RESPONSE_PARSE_ERROR_MESSAGE =
  "Coach Chris had trouble reading the draft response. Please retry.";

export type TailoredDraftFailureCode =
  | "model_overloaded"
  | "missing_resume"
  | "missing_job"
  | "prompt_too_large"
  | "response_parse_error"
  | "unknown_error";

const LEGACY_CODE_MAP: Record<string, TailoredDraftFailureCode> = {
  missing_analysis: "unknown_error",
  configuration: "unknown_error",
  draft_failed: "unknown_error",
  invalid_payload: "unknown_error",
  api_key_missing: "unknown_error",
};

export function normalizeTailoredDraftFailureCode(
  code: string | undefined,
): TailoredDraftFailureCode | undefined {
  if (!code) return undefined;
  if (
    code === "model_overloaded" ||
    code === "missing_resume" ||
    code === "missing_job" ||
    code === "prompt_too_large" ||
    code === "response_parse_error" ||
    code === "unknown_error"
  ) {
    return code;
  }
  const fromAnalysis = normalizeAnalysisFailureCode(code);
  if (fromAnalysis === "api_key_missing" || fromAnalysis === "invalid_payload") {
    return "unknown_error";
  }
  if (fromAnalysis) {
    return fromAnalysis as TailoredDraftFailureCode;
  }
  return LEGACY_CODE_MAP[code];
}

function extractNestedApiErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: string | { message?: string; code?: number | string };
      message?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string") {
      return parsed.error.message;
    }
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    return trimmed;
  }
  return trimmed;
}

function normalizeFailureInput(error: unknown): string {
  if (error instanceof Error) return extractNestedApiErrorMessage(error.message);
  if (typeof error === "string") return extractNestedApiErrorMessage(error);
  if (error && typeof error === "object") {
    const entry = error as { message?: string; error?: string | { message?: string } };
    if (typeof entry.message === "string") return extractNestedApiErrorMessage(entry.message);
    if (typeof entry.error === "string") return extractNestedApiErrorMessage(entry.error);
    if (entry.error && typeof entry.error === "object" && typeof entry.error.message === "string") {
      return entry.error.message;
    }
    try {
      return extractNestedApiErrorMessage(JSON.stringify(error));
    } catch {
      return "";
    }
  }
  return "";
}

export function classifyTailoredDraftFailure(error: unknown): {
  code: TailoredDraftFailureCode;
  retryable: boolean;
} {
  const classified = classifyAnalysisFailure(error);
  const code = normalizeTailoredDraftFailureCode(classified.code) ?? "unknown_error";
  if (code === "missing_resume" || code === "missing_job" || code === "prompt_too_large") {
    return { code, retryable: false };
  }
  return { code, retryable: classified.retryable };
}

export function messageForTailoredDraftFailureCode(
  code: TailoredDraftFailureCode | undefined,
  fallbackError?: string,
): { message: string; retryable: boolean } {
  switch (code) {
    case "model_overloaded":
      return { message: TAILORED_DRAFT_TEMPORARY_FAILURE_MESSAGE, retryable: true };
    case "missing_resume":
      return { message: TAILORED_DRAFT_MISSING_RESUME_MESSAGE, retryable: false };
    case "missing_job":
      return { message: TAILORED_DRAFT_MISSING_JOB_MESSAGE, retryable: false };
    case "prompt_too_large":
      return { message: TAILORED_DRAFT_PROMPT_TOO_LARGE_MESSAGE, retryable: false };
    case "response_parse_error":
      return { message: TAILORED_DRAFT_RESPONSE_PARSE_ERROR_MESSAGE, retryable: true };
    case "unknown_error":
      return { message: TAILORED_DRAFT_GENERIC_RETRY_MESSAGE, retryable: true };
    default:
      if (fallbackError) {
        const fromError = classifyTailoredDraftFailure(fallbackError);
        return messageForTailoredDraftFailureCode(fromError.code);
      }
      return { message: TAILORED_DRAFT_GENERIC_RETRY_MESSAGE, retryable: true };
  }
}

export function toUserFacingTailoredDraftError(error: unknown): {
  message: string;
  retryable: boolean;
  code: TailoredDraftFailureCode;
} {
  const classified = classifyTailoredDraftFailure(error);
  const mapped = messageForTailoredDraftFailureCode(classified.code);
  return {
    message: mapped.message,
    retryable: mapped.retryable,
    code: classified.code,
  };
}

export function sanitizeTailoredDraftErrorMessage(message: string | undefined | null): string {
  if (!message || message.trim().length === 0) {
    return TAILORED_DRAFT_GENERIC_RETRY_MESSAGE;
  }
  const normalized = normalizeFailureInput(message);
  if (looksLikeRawTechnicalError(normalized) || normalized.trim().startsWith("{")) {
    return toUserFacingTailoredDraftError(normalized).message;
  }
  return toUserFacingTailoredDraftError(normalized).message;
}

export function parseTailoredDraftFailureResponse(
  status: number,
  body: { error?: string | { message?: string }; retryable?: boolean; code?: string } | null,
): { message: string; retryable: boolean; code: TailoredDraftFailureCode } {
  const normalizedCode = normalizeTailoredDraftFailureCode(body?.code);
  const rawError =
    typeof body?.error === "string"
      ? body.error
      : body?.error && typeof body.error === "object" && typeof body.error.message === "string"
        ? body.error.message
        : undefined;

  if (normalizedCode) {
    const mapped = messageForTailoredDraftFailureCode(normalizedCode, rawError);
    return {
      message: mapped.message,
      retryable: body?.retryable ?? mapped.retryable,
      code: normalizedCode,
    };
  }

  if (rawError) {
    const fromBody = toUserFacingTailoredDraftError(rawError);
    return {
      message: fromBody.message,
      retryable: body?.retryable ?? fromBody.retryable,
      code: fromBody.code,
    };
  }

  if (status === 429 || status === 503 || status >= 500) {
    return {
      message: TAILORED_DRAFT_TEMPORARY_FAILURE_MESSAGE,
      retryable: true,
      code: "model_overloaded",
    };
  }

  if (status === 413) {
    return {
      message: TAILORED_DRAFT_PROMPT_TOO_LARGE_MESSAGE,
      retryable: false,
      code: "prompt_too_large",
    };
  }

  return {
    message: TAILORED_DRAFT_GENERIC_RETRY_MESSAGE,
    retryable: status >= 500,
    code: status >= 500 ? "model_overloaded" : "unknown_error",
  };
}
