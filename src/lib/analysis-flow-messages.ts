export const ANALYSIS_PROGRESS_STEPS = [
  "Reading your resume…",
  "Comparing against the job…",
  "Identifying key gaps…",
  "Preparing recommendations…",
] as const;

export type AnalysisProgressStep = (typeof ANALYSIS_PROGRESS_STEPS)[number];

/** @deprecated Prefer messageForAnalysisFailureCode("model_overloaded") */
export const ANALYSIS_TEMPORARY_FAILURE_MESSAGE =
  "Coach Chris is temporarily busy. Please try again in a moment.";

export const ANALYSIS_GENERIC_RETRY_MESSAGE =
  "Could not generate analysis right now. Please try again in a moment.";

export const ANALYSIS_SUCCESS_MESSAGE = "Analysis complete";

export const ANALYSIS_MISSING_INPUTS_MESSAGE =
  "Add a resume and job description before running analysis.";

export const ANALYSIS_MISSING_RESUME_MESSAGE =
  "Add or activate a resume before running analysis.";

export const ANALYSIS_MISSING_JOB_MESSAGE = "Add a job before running analysis.";

export const ANALYSIS_INVALID_PAYLOAD_MESSAGE =
  "Something was missing from the analysis request. Check your resume and job details, then try again.";

export const ANALYSIS_PROMPT_TOO_LARGE_MESSAGE =
  "This resume or job description is too long to analyze cleanly. Try shortening the job post.";

export const ANALYSIS_RESPONSE_PARSE_ERROR_MESSAGE =
  "Coach Chris had trouble reading the analysis response. Please retry.";

export const ANALYSIS_API_KEY_MISSING_MESSAGE =
  "Live analysis is unavailable right now because the AI service is not configured. Please try again later.";

export type AnalysisFailureCode =
  | "model_overloaded"
  | "missing_resume"
  | "missing_job"
  | "invalid_payload"
  | "prompt_too_large"
  | "response_parse_error"
  | "api_key_missing"
  | "unknown_error";

const LEGACY_FAILURE_CODE_MAP: Record<string, AnalysisFailureCode> = {
  missing_inputs: "invalid_payload",
  payload_too_large: "prompt_too_large",
  configuration: "api_key_missing",
  invalid_response: "response_parse_error",
  provider_error: "model_overloaded",
  generic: "unknown_error",
};

export function normalizeAnalysisFailureCode(
  code: string | undefined,
): AnalysisFailureCode | undefined {
  if (!code) return undefined;
  if (
    code === "model_overloaded" ||
    code === "missing_resume" ||
    code === "missing_job" ||
    code === "invalid_payload" ||
    code === "prompt_too_large" ||
    code === "response_parse_error" ||
    code === "api_key_missing" ||
    code === "unknown_error"
  ) {
    return code;
  }
  return LEGACY_FAILURE_CODE_MAP[code];
}

function normalizeErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function looksLikeRawTechnicalError(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  if (/^(Error|TypeError|SyntaxError|FetchError):/i.test(trimmed)) return true;
  if (trimmed.includes(" at ") && trimmed.includes(".ts")) return true;
  if (trimmed.length > 280) return true;
  return false;
}

function isModelOverloadedFailureText(normalized: string): boolean {
  return (
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("quota") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("overloaded") ||
    normalized.includes("unavailable") ||
    normalized.includes("503") ||
    normalized.includes("502") ||
    normalized.includes("500") ||
    normalized.includes("resource exhausted") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econnreset")
  );
}

function isConfigurationFailureText(normalized: string): boolean {
  return (
    normalized.includes("gemini_api_key") ||
    normalized.includes("not configured") ||
    normalized.includes("missing valid gemini")
  );
}

function isResponseParseFailureText(normalized: string): boolean {
  return (
    normalized.includes("invalid json") ||
    normalized.includes("returned invalid json") ||
    normalized.includes("json parse") ||
    normalized.includes("unexpected token")
  );
}

export function classifyAnalysisFailure(error: unknown): {
  code: AnalysisFailureCode;
  retryable: boolean;
} {
  const raw = normalizeErrorText(error);
  if (!raw.trim()) {
    return { code: "unknown_error", retryable: true };
  }

  const normalized = raw.toLowerCase();

  if (isConfigurationFailureText(normalized)) {
    return { code: "api_key_missing", retryable: false };
  }

  if (isResponseParseFailureText(normalized)) {
    return { code: "response_parse_error", retryable: true };
  }

  if (isModelOverloadedFailureText(normalized)) {
    return { code: "model_overloaded", retryable: true };
  }

  if (looksLikeRawTechnicalError(raw)) {
    return { code: "unknown_error", retryable: true };
  }

  return { code: "unknown_error", retryable: true };
}

export function toUserFacingAnalysisError(error: unknown): {
  message: string;
  retryable: boolean;
  code: AnalysisFailureCode;
} {
  const classified = classifyAnalysisFailure(error);
  const mapped = messageForAnalysisFailureCode(classified.code);
  return {
    message: mapped.message,
    retryable: mapped.retryable,
    code: classified.code,
  };
}

export function sanitizeAnalysisErrorMessage(message: string | undefined | null): string {
  if (!message || message.trim().length === 0) {
    return ANALYSIS_GENERIC_RETRY_MESSAGE;
  }
  return toUserFacingAnalysisError(message).message;
}

export function messageForAnalysisFailureCode(
  code: AnalysisFailureCode | undefined,
  fallbackError?: string,
): { message: string; retryable: boolean } {
  switch (code) {
    case "model_overloaded":
      return { message: ANALYSIS_TEMPORARY_FAILURE_MESSAGE, retryable: true };
    case "missing_resume":
      return { message: ANALYSIS_MISSING_RESUME_MESSAGE, retryable: false };
    case "missing_job":
      return { message: ANALYSIS_MISSING_JOB_MESSAGE, retryable: false };
    case "invalid_payload":
      return { message: ANALYSIS_INVALID_PAYLOAD_MESSAGE, retryable: false };
    case "prompt_too_large":
      return { message: ANALYSIS_PROMPT_TOO_LARGE_MESSAGE, retryable: false };
    case "response_parse_error":
      return { message: ANALYSIS_RESPONSE_PARSE_ERROR_MESSAGE, retryable: true };
    case "api_key_missing":
      return { message: ANALYSIS_API_KEY_MISSING_MESSAGE, retryable: false };
    case "unknown_error":
      return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: true };
    default:
      if (fallbackError) {
        const fromError = toUserFacingAnalysisError(fallbackError);
        return { message: fromError.message, retryable: fromError.retryable };
      }
      return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: true };
  }
}

export function parseAnalysisFailureResponse(
  status: number,
  body: { error?: string; retryable?: boolean; code?: string } | null,
): { message: string; retryable: boolean; code?: AnalysisFailureCode } {
  const normalizedCode = normalizeAnalysisFailureCode(body?.code);

  if (normalizedCode) {
    const mapped = messageForAnalysisFailureCode(normalizedCode, body?.error);
    return {
      message: mapped.message,
      retryable: body?.retryable ?? mapped.retryable,
      code: normalizedCode,
    };
  }

  if (body?.error) {
    const fromBody = toUserFacingAnalysisError(body.error);
    return {
      message: fromBody.message,
      retryable: body?.retryable ?? fromBody.retryable,
      code: fromBody.code,
    };
  }

  if (status === 429 || status === 503 || status >= 500) {
    return {
      message: ANALYSIS_TEMPORARY_FAILURE_MESSAGE,
      retryable: true,
      code: "model_overloaded",
    };
  }

  if (status === 413) {
    return {
      message: ANALYSIS_PROMPT_TOO_LARGE_MESSAGE,
      retryable: false,
      code: "prompt_too_large",
    };
  }

  if (status >= 400) {
    return {
      message: ANALYSIS_GENERIC_RETRY_MESSAGE,
      retryable: status >= 500,
      code: status >= 500 ? "model_overloaded" : "unknown_error",
    };
  }

  return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: true, code: "unknown_error" };
}
