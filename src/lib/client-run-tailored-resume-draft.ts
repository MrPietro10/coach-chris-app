import { getProviderConfig } from "@/lib/ai";
import type { AnalysisResumeContext } from "@/lib/analysis-resume-context";
import {
  parseTailoredDraftFailureResponse,
  toUserFacingTailoredDraftError,
  type TailoredDraftFailureCode,
} from "@/lib/tailored-draft-flow-messages";
import { normalizeTailoredDraftPayload, type TailoredResumeDraft } from "@/lib/tailored-resume-draft";
import type { FitCategory } from "@/types/coach";

const MAX_CLIENT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RunTailoredResumeDraftResult =
  | { ok: true; draft: TailoredResumeDraft }
  | {
      ok: false;
      message: string;
      retryable: boolean;
      code: TailoredDraftFailureCode;
    };

export type RunTailoredResumeDraftInput = {
  selectedJob: {
    jobId: string;
    title: string;
    company: string;
    location: string;
    description: string;
    requiredSkills: string[];
  };
  resumeContext: AnalysisResumeContext;
  analysisContext: {
    fit: FitCategory;
    score: number;
    fitSummary: string;
    topStrengths: string[];
    topGaps: string[];
    highestPriorityImprovement: string;
    missingEvidence: string[];
    riskAreas: string[];
  };
  sourceResume?: { id: string; name: string };
};

async function requestTailoredResumeDraftOnce(
  input: RunTailoredResumeDraftInput,
): Promise<RunTailoredResumeDraftResult> {
  try {
    const response = await fetch("/api/coach/tailored-resume-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        providerConfig: getProviderConfig(),
      }),
    });

    type TailoredDraftApiBody = {
      error?: string | { message?: string };
      draft?: TailoredResumeDraft;
      retryable?: boolean;
      code?: string;
    };

    let body: TailoredDraftApiBody | null = null;

    try {
      body = (await response.json()) as TailoredDraftApiBody;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const failure = parseTailoredDraftFailureResponse(response.status, body);
      if (process.env.NODE_ENV !== "production") {
        console.warn("[runTailoredResumeDraft] draft_api_failed", {
          status: response.status,
          code: failure.code,
          jobId: input.selectedJob.jobId,
          resumeId: input.sourceResume?.id ?? null,
        });
      }
      return {
        ok: false,
        message: failure.message,
        retryable: failure.retryable,
        code: failure.code,
      };
    }

    if (!body?.draft) {
      return {
        ok: false,
        message: "Coach Chris returned an empty draft. Please try again.",
        retryable: true,
        code: "unknown_error",
      };
    }

    return {
      ok: true,
      draft: normalizeTailoredDraftPayload(body.draft),
    };
  } catch (error) {
    const failure = toUserFacingTailoredDraftError(error);
    return {
      ok: false,
      message: failure.message,
      retryable: failure.retryable,
      code: failure.code,
    };
  }
}

export async function runTailoredResumeDraftWithRetry(
  input: RunTailoredResumeDraftInput,
): Promise<RunTailoredResumeDraftResult> {
  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    const result = await requestTailoredResumeDraftOnce(input);
    if (result.ok) {
      return result;
    }

    const shouldRetry =
      result.retryable &&
      result.code === "model_overloaded" &&
      attempt < MAX_CLIENT_RETRIES;

    if (!shouldRetry) {
      return result;
    }

    const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;
    if (process.env.NODE_ENV !== "production") {
      console.info("[runTailoredResumeDraft] retrying_after_overload", {
        attempt: attempt + 1,
        delayMs,
        jobId: input.selectedJob.jobId,
      });
    }
    await sleep(delayMs);
  }

  return {
    ok: false,
    message: parseTailoredDraftFailureResponse(503, null).message,
    retryable: true,
    code: "model_overloaded",
  };
}
