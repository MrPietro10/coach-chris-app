import { getProviderConfig, type AnalyzeSelectedJobOutput } from "@/lib/ai";
import { buildAnalysisInputFingerprint } from "@/lib/analysis-input-fingerprint";
import {
  ANALYSIS_TEMPORARY_FAILURE_MESSAGE,
  type AnalysisFailureCode,
  parseAnalysisFailureResponse,
  toUserFacingAnalysisError,
} from "@/lib/analysis-flow-messages";
import type { AnalysisResumeContext } from "@/lib/analysis-resume-context";
import { validateAnalysisRequest } from "@/lib/analysis-request";
import {
  getProviderUnavailableMessage,
  toComputedJobAnalysis,
} from "@/lib/computed-job-analysis-mapper";
import type { ComputedJobAnalysis } from "@/lib/job-session-store";
import type { ConfidenceLevel, JobAnalysis, JobPosting } from "@/types/coach";
import type { OptimizeJobData } from "@/types/coach";
import { inferConfidenceLevel } from "@/utils/fit";

export type RunJobAnalysisResult =
  | {
      ok: true;
      analysis: ComputedJobAnalysis;
      fromCache: boolean;
    }
  | {
      ok: false;
      message: string;
      retryable: boolean;
    };

export function calculateResumeCompleteness(input: {
  summary: string;
  skills: string;
  highlights: string;
}): number {
  const hasSummary = input.summary.trim().length > 0 ? 1 : 0;
  const hasSkills =
    input.skills
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0).length > 0
      ? 1
      : 0;
  const hasHighlights =
    input.highlights
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0).length > 0
      ? 1
      : 0;

  return Math.round(((hasSummary + hasSkills + hasHighlights) / 3) * 100);
}

export async function runJobAnalysisForPosting(options: {
  job: JobPosting;
  resumeContext: AnalysisResumeContext;
  resumeCompleteness: number;
  storedComputed?: ComputedJobAnalysis;
  existingReadyAnalysis?: JobAnalysis;
  optimizeData?: OptimizeJobData;
  forceRefresh?: boolean;
}): Promise<RunJobAnalysisResult> {
  const { job, resumeContext, resumeCompleteness, storedComputed, existingReadyAnalysis, optimizeData } =
    options;

  const requestValidation = validateAnalysisRequest({
    jobDescription: job.description,
    resumeContext,
    jobTitle: job.title,
    jobCompany: job.company,
  });

  if (!requestValidation.ok) {
    return { ok: false, message: requestValidation.message, retryable: false };
  }

  const inputFingerprint = buildAnalysisInputFingerprint({
    jobId: job.id,
    jobDescription: job.description,
    resumeContext,
  });

  const shouldUseCachedAnalysis =
    !options.forceRefresh &&
    storedComputed?.analysisState === "ready" &&
    storedComputed.inputFingerprint === inputFingerprint;

  if (shouldUseCachedAnalysis) {
    return { ok: true, analysis: storedComputed, fromCache: true };
  }

  try {
    const response = await fetch("/api/coach/single-job-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedJob: {
          jobId: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          requiredSkills: job.requiredSkills,
        },
        resumeContext,
        fitContext: existingReadyAnalysis
          ? {
              fit: existingReadyAnalysis.fit,
              score: existingReadyAnalysis.score,
              topStrengths: existingReadyAnalysis.strengths.slice(0, 3),
              topGaps: existingReadyAnalysis.gaps.slice(0, 3),
            }
          : undefined,
        optimizeContext: optimizeData
          ? {
              targetRole: optimizeData.targetRole.title,
              targetCompany: optimizeData.targetRole.company,
              keyChanges: Object.values(optimizeData.changes)
                .map((change) => change.whatChanged)
                .slice(0, 3),
              metricPrompts: optimizeData.metricInputs.map((metric) => metric.helpText).slice(0, 3),
            }
          : undefined,
        providerConfig: getProviderConfig(),
      }),
    });

    if (!response.ok) {
      let failureBody: { error?: string; retryable?: boolean; code?: string } | null = null;
      try {
        failureBody = (await response.json()) as {
          error?: string;
          retryable?: boolean;
          code?: string;
        };
      } catch {
        failureBody = null;
      }
      const failure = parseAnalysisFailureResponse(
        response.status,
        failureBody
          ? { ...failureBody, code: failureBody.code as AnalysisFailureCode | undefined }
          : null,
      );
      return {
        ok: false,
        message: failure.retryable ? ANALYSIS_TEMPORARY_FAILURE_MESSAGE : failure.message,
        retryable: failure.retryable,
      };
    }

    const payload = (await response.json()) as AnalyzeSelectedJobOutput;
    const unavailableMessage = getProviderUnavailableMessage(payload);
    if (unavailableMessage) {
      const canRetry = !unavailableMessage.toLowerCase().includes("gemini_api_key");
      return {
        ok: false,
        message: canRetry ? ANALYSIS_TEMPORARY_FAILURE_MESSAGE : unavailableMessage,
        retryable: canRetry,
      };
    }

    const computedBase = toComputedJobAnalysis(job.id, payload);
    const nextConfidence: ConfidenceLevel = inferConfidenceLevel({
      resumeCompleteness,
      missingEvidenceCount: computedBase.missingEvidence.length,
      keyRequirementEvidenceCount: computedBase.strengths.length,
      evidenceItems: computedBase.strengths,
    });

    return {
      ok: true,
      fromCache: false,
      analysis: {
        ...computedBase,
        inputFingerprint,
        confidenceLevel: nextConfidence,
      },
    };
  } catch (error) {
    const failure = toUserFacingAnalysisError(error);
    return {
      ok: false,
      message: failure.retryable ? ANALYSIS_TEMPORARY_FAILURE_MESSAGE : failure.message,
      retryable: failure.retryable,
    };
  }
}
