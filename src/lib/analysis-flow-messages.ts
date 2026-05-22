export const ANALYSIS_PROGRESS_STEPS = [
  "Reading your resume…",
  "Comparing against the job…",
  "Identifying key gaps…",
  "Preparing recommendations…",
] as const;

export type AnalysisProgressStep = (typeof ANALYSIS_PROGRESS_STEPS)[number];

export const ANALYSIS_TEMPORARY_FAILURE_MESSAGE =
  "Coach Chris is temporarily experiencing heavy analysis demand. Your information is safe — please try again in a moment.";

export const ANALYSIS_GENERIC_RETRY_MESSAGE =
  "Could not generate analysis right now. Please try again in a moment.";

export const ANALYSIS_SUCCESS_MESSAGE =
  "Analysis complete. Review your fit, gaps, and next steps.";

export const ANALYSIS_MISSING_INPUTS_MESSAGE =
  "Add a resume and job description before running analysis.";

export const ANALYSIS_PAYLOAD_TOO_LARGE_MESSAGE =
  "This job post or resume is too long to analyze cleanly. Try shortening the job description.";

export type AnalysisFailureCode =
  | "missing_inputs"
  | "payload_too_large"
  | "configuration"
  | "provider_error"
  | "invalid_response"
  | "generic";

function normalizeErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function looksLikeRawTechnicalError(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  if (/^(Error|TypeError|SyntaxError|FetchError):/i.test(trimmed)) return true;
  if (trimmed.includes(" at ") && trimmed.includes(".ts")) return true;
  if (trimmed.length > 280) return true;
  return false;
}

function isRetryableFailureText(normalized: string): boolean {
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
    normalized.includes("econnreset") ||
    normalized.includes("invalid json")
  );
}

function isConfigurationFailureText(normalized: string): boolean {
  return (
    normalized.includes("gemini_api_key") ||
    normalized.includes("not configured") ||
    normalized.includes("missing valid gemini")
  );
}

export function toUserFacingAnalysisError(error: unknown): {
  message: string;
  retryable: boolean;
} {
  const raw = normalizeErrorText(error);
  if (!raw.trim()) {
    return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: true };
  }

  const normalized = raw.toLowerCase();

  if (isConfigurationFailureText(normalized)) {
    return {
      message:
        "Live analysis is unavailable because Gemini is not configured on the server. Add a valid GEMINI_API_KEY and try again.",
      retryable: false,
    };
  }

  if (looksLikeRawTechnicalError(raw) || isRetryableFailureText(normalized)) {
    return { message: ANALYSIS_TEMPORARY_FAILURE_MESSAGE, retryable: true };
  }

  return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: true };
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
    case "missing_inputs":
      return { message: ANALYSIS_MISSING_INPUTS_MESSAGE, retryable: false };
    case "payload_too_large":
      return { message: ANALYSIS_PAYLOAD_TOO_LARGE_MESSAGE, retryable: false };
    case "configuration":
      return {
        message:
          "Live analysis is unavailable because Gemini is not configured on the server. Add a valid GEMINI_API_KEY and try again.",
        retryable: false,
      };
    case "invalid_response":
      return { message: ANALYSIS_TEMPORARY_FAILURE_MESSAGE, retryable: true };
    case "provider_error":
      return { message: ANALYSIS_TEMPORARY_FAILURE_MESSAGE, retryable: true };
    default:
      if (fallbackError) {
        return toUserFacingAnalysisError(fallbackError);
      }
      return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: true };
  }
}

export function parseAnalysisFailureResponse(
  status: number,
  body: { error?: string; retryable?: boolean; code?: AnalysisFailureCode } | null,
): { message: string; retryable: boolean; code?: AnalysisFailureCode } {
  if (body?.code) {
    const mapped = messageForAnalysisFailureCode(body.code, body.error);
    return {
      ...mapped,
      retryable: body.retryable ?? mapped.retryable,
      code: body.code,
    };
  }

  const fromBody = body?.error ? toUserFacingAnalysisError(body.error) : null;
  if (fromBody) {
    return {
      message: fromBody.message,
      retryable: body?.retryable ?? fromBody.retryable,
    };
  }

  if (status === 429 || status === 503 || status >= 500) {
    return { message: ANALYSIS_TEMPORARY_FAILURE_MESSAGE, retryable: true, code: "provider_error" };
  }

  if (status === 413) {
    return {
      message: ANALYSIS_PAYLOAD_TOO_LARGE_MESSAGE,
      retryable: false,
      code: "payload_too_large",
    };
  }

  if (status >= 400) {
    return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: status >= 500 };
  }

  return { message: ANALYSIS_GENERIC_RETRY_MESSAGE, retryable: true };
}
