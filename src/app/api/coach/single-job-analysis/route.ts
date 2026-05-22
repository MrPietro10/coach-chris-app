import { NextResponse } from "next/server";
import { analyzeSelectedJob, type AnalyzeSelectedJobInput, type ProviderConfigState } from "@/lib/ai";
import { toUserFacingAnalysisError } from "@/lib/analysis-flow-messages";
import {
  logAnalysisDiagnostic,
  logAnalysisError,
  safeErrorSnippet,
  validateAnalysisRequest,
} from "@/lib/analysis-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeSelectedJobRequestBody = {
  selectedJob: AnalyzeSelectedJobInput["selectedJob"];
  resumeContext: AnalyzeSelectedJobInput["resumeContext"];
  fitContext?: AnalyzeSelectedJobInput["fitContext"];
  optimizeContext?: AnalyzeSelectedJobInput["optimizeContext"];
  providerConfig?: ProviderConfigState;
};

function isResumeContext(
  resumeContext: AnalyzeSelectedJobRequestBody["resumeContext"] | undefined,
): resumeContext is AnalyzeSelectedJobInput["resumeContext"] {
  if (!resumeContext) return false;
  return (
    Boolean(resumeContext.summary?.trim()) ||
    resumeContext.skills.length > 0 ||
    resumeContext.experienceHighlights.length > 0
  );
}

export async function POST(request: Request) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const hasGeminiKey = Boolean(geminiApiKey && geminiApiKey.trim().length > 0);

  try {
    logAnalysisDiagnostic("request_received", {
      runtime: "nodejs",
      hasGeminiKey,
    });

    const body = (await request.json()) as Partial<AnalyzeSelectedJobRequestBody>;
    const jobId = body.selectedJob?.jobId ?? "";
    const hasResume = isResumeContext(body.resumeContext);

    logAnalysisDiagnostic("request_parsed", {
      jobId,
      hasResume,
      hasJobTitle: Boolean(body.selectedJob?.title?.trim()),
      hasJobCompany: Boolean(body.selectedJob?.company?.trim()),
      jobDescriptionChars: body.selectedJob?.description?.length ?? 0,
      resumeSummaryChars: body.resumeContext?.summary?.length ?? 0,
      resumeSkillsCount: body.resumeContext?.skills?.length ?? 0,
      resumeHighlightsCount: body.resumeContext?.experienceHighlights?.length ?? 0,
    });

    if (!body.selectedJob?.jobId || !body.selectedJob?.title || !body.selectedJob?.company) {
      return NextResponse.json(
        {
          error: "Selected job context is required.",
          code: "missing_inputs",
          retryable: false,
        },
        { status: 400 },
      );
    }

    if (!body.selectedJob.description?.trim()) {
      return NextResponse.json(
        {
          error: "Add a resume and job description before running analysis.",
          code: "missing_inputs",
          retryable: false,
        },
        { status: 400 },
      );
    }

    const resumeContext = body.resumeContext;
    if (!isResumeContext(resumeContext)) {
      return NextResponse.json(
        {
          error: "Add a resume and job description before running analysis.",
          code: "missing_inputs",
          retryable: false,
        },
        { status: 400 },
      );
    }

    const payloadCheck = validateAnalysisRequest({
      jobDescription: body.selectedJob.description,
      resumeContext,
      jobTitle: body.selectedJob.title,
      jobCompany: body.selectedJob.company,
    });

    if (!payloadCheck.ok) {
      logAnalysisDiagnostic("validation_failed", {
        jobId,
        code: payloadCheck.code,
        payloadChars: payloadCheck.code === "payload_too_large" ? "over_limit" : undefined,
      });
      return NextResponse.json(
        {
          error: payloadCheck.message,
          code: payloadCheck.code,
          retryable: false,
        },
        { status: payloadCheck.code === "payload_too_large" ? 413 : 400 },
      );
    }

    if (!hasGeminiKey || geminiApiKey === "your_real_key_here") {
      logAnalysisDiagnostic("configuration_missing", { jobId });
      return NextResponse.json(
        {
          error:
            "Live analysis is unavailable because Gemini is not configured on the server. Add a valid GEMINI_API_KEY and try again.",
          code: "configuration",
          retryable: false,
        },
        { status: 503 },
      );
    }

    logAnalysisDiagnostic("analysis_started", {
      jobId,
      payloadChars: payloadCheck.payloadChars,
      hasFitContext: Boolean(body.fitContext),
      hasOptimizeContext: Boolean(body.optimizeContext),
    });

    const response = await analyzeSelectedJob(
      {
        selectedJob: body.selectedJob,
        resumeContext,
        fitContext: body.fitContext,
        optimizeContext: body.optimizeContext,
      },
      {
        providerConfig: body.providerConfig,
      },
    );

    logAnalysisDiagnostic("analysis_success", {
      jobId,
      provider: response.provider,
      fitScore: response.fitScore,
    });

    return NextResponse.json(response);
  } catch (error) {
    const snippet = safeErrorSnippet(error);
    const normalized = snippet.toLowerCase();
    const retryable =
      normalized.includes("429") ||
      normalized.includes("503") ||
      normalized.includes("502") ||
      normalized.includes("500") ||
      normalized.includes("overloaded") ||
      normalized.includes("timeout") ||
      normalized.includes("timed out") ||
      normalized.includes("resource exhausted") ||
      normalized.includes("fetch failed") ||
      normalized.includes("network") ||
      normalized.includes("invalid json");

    const code = normalized.includes("invalid json")
      ? "invalid_response"
      : retryable
        ? "provider_error"
        : "generic";

    logAnalysisError("analysis_failed", error, {
      hasGeminiKey,
      code,
      retryable,
      snippet,
    });

    const { message, retryable: mappedRetryable } = toUserFacingAnalysisError(error);
    return NextResponse.json(
      {
        error: message,
        code,
        retryable: retryable || mappedRetryable,
      },
      { status: retryable ? 503 : 500 },
    );
  }
}
