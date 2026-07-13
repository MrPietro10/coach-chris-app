import { NextResponse } from "next/server";
import { analyzeSelectedJob, type AnalyzeSelectedJobInput, type ProviderConfigState } from "@/lib/ai";
import {
  classifyAnalysisFailure,
  messageForAnalysisFailureCode,
} from "@/lib/analysis-flow-messages";
import {
  estimateAnalysisPayloadChars,
  estimateResumeTextLength,
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
  resumeMeta?: {
    id?: string | null;
    name?: string | null;
  };
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

function buildRequestDiagnostics(input: {
  jobId: string;
  body: Partial<AnalyzeSelectedJobRequestBody>;
  hasResume: boolean;
  payloadCharsEstimate?: number;
  geminiConfigured: boolean;
  geminiApiStatus?: string;
}): Record<string, unknown> {
  const resumeContext = input.body.resumeContext;
  const description = input.body.selectedJob?.description ?? "";

  return {
    selectedJobId: input.jobId || null,
    activeResumeId: input.body.resumeMeta?.id ?? null,
    activeResumeName: input.body.resumeMeta?.name ?? null,
    resumeTextLength: resumeContext ? estimateResumeTextLength(resumeContext) : 0,
    jobDescriptionLength: description.length,
    payloadCharsEstimate: input.payloadCharsEstimate ?? null,
    geminiConfigured: input.geminiConfigured,
    geminiApiStatus: input.geminiApiStatus ?? null,
  };
}

function analysisFailureResponse(
  code: Parameters<typeof messageForAnalysisFailureCode>[0],
  options?: { status?: number; diagnostics?: Record<string, unknown> },
) {
  const mapped = messageForAnalysisFailureCode(code);
  if (options?.diagnostics) {
    logAnalysisDiagnostic("analysis_failure_response", {
      code,
      retryable: mapped.retryable,
      ...options.diagnostics,
    });
  }
  return NextResponse.json(
    {
      error: mapped.message,
      code,
      retryable: mapped.retryable,
    },
    { status: options?.status ?? (mapped.retryable ? 503 : 400) },
  );
}

export async function POST(request: Request) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const hasGeminiKey = Boolean(geminiApiKey && geminiApiKey.trim().length > 0);
  let parsedBody: Partial<AnalyzeSelectedJobRequestBody> = {};

  try {
    logAnalysisDiagnostic("request_received", {
      runtime: "nodejs",
      geminiConfigured: hasGeminiKey,
    });

    parsedBody = (await request.json()) as Partial<AnalyzeSelectedJobRequestBody>;
    const jobId = parsedBody.selectedJob?.jobId ?? "";
    const hasResume = isResumeContext(parsedBody.resumeContext);
    const jobDescriptionLength = parsedBody.selectedJob?.description?.length ?? 0;
    const resumeTextLength = parsedBody.resumeContext
      ? estimateResumeTextLength(parsedBody.resumeContext)
      : 0;
    const payloadCharsEstimate =
      parsedBody.selectedJob?.description && parsedBody.resumeContext
        ? estimateAnalysisPayloadChars({
            jobDescription: parsedBody.selectedJob.description,
            resumeContext: parsedBody.resumeContext,
            jobTitle: parsedBody.selectedJob.title,
            jobCompany: parsedBody.selectedJob.company,
          })
        : undefined;

    const requestDiagnostics = buildRequestDiagnostics({
      jobId,
      body: parsedBody,
      hasResume,
      payloadCharsEstimate,
      geminiConfigured: hasGeminiKey,
    });

    logAnalysisDiagnostic("request_parsed", {
      ...requestDiagnostics,
      hasResume,
      hasJobTitle: Boolean(parsedBody.selectedJob?.title?.trim()),
      hasJobCompany: Boolean(parsedBody.selectedJob?.company?.trim()),
      resumeSummaryChars: parsedBody.resumeContext?.summary?.length ?? 0,
      resumeSkillsCount: parsedBody.resumeContext?.skills?.length ?? 0,
      resumeHighlightsCount: parsedBody.resumeContext?.experienceHighlights?.length ?? 0,
    });

    if (!parsedBody.selectedJob?.jobId || !parsedBody.selectedJob?.title || !parsedBody.selectedJob?.company) {
      return analysisFailureResponse("missing_job", {
        status: 400,
        diagnostics: requestDiagnostics,
      });
    }

    if (!parsedBody.selectedJob.description?.trim()) {
      return analysisFailureResponse("missing_job", {
        status: 400,
        diagnostics: { ...requestDiagnostics, jobDescriptionLength },
      });
    }

    const resumeContext = parsedBody.resumeContext;
    if (!isResumeContext(resumeContext)) {
      return analysisFailureResponse("missing_resume", {
        status: 400,
        diagnostics: { ...requestDiagnostics, resumeTextLength },
      });
    }

    const payloadCheck = validateAnalysisRequest({
      jobDescription: parsedBody.selectedJob.description,
      resumeContext,
      jobTitle: parsedBody.selectedJob.title,
      jobCompany: parsedBody.selectedJob.company,
    });

    if (!payloadCheck.ok) {
      logAnalysisDiagnostic("validation_failed", {
        ...requestDiagnostics,
        code: payloadCheck.code,
        payloadCharsEstimate: payloadCheck.code === "prompt_too_large" ? "over_limit" : payloadCharsEstimate,
      });
      return analysisFailureResponse(payloadCheck.code, {
        status: payloadCheck.code === "prompt_too_large" ? 413 : 400,
        diagnostics: requestDiagnostics,
      });
    }

    if (!hasGeminiKey || geminiApiKey === "your_real_key_here") {
      logAnalysisDiagnostic("configuration_missing", requestDiagnostics);
      return analysisFailureResponse("api_key_missing", {
        status: 503,
        diagnostics: requestDiagnostics,
      });
    }

    logAnalysisDiagnostic("analysis_started", {
      ...requestDiagnostics,
      payloadChars: payloadCheck.payloadChars,
      hasFitContext: Boolean(parsedBody.fitContext),
      hasOptimizeContext: Boolean(parsedBody.optimizeContext),
    });

    const response = await analyzeSelectedJob(
      {
        selectedJob: parsedBody.selectedJob,
        resumeContext,
        fitContext: parsedBody.fitContext,
        optimizeContext: parsedBody.optimizeContext,
      },
      {
        providerConfig: parsedBody.providerConfig,
      },
    );

    logAnalysisDiagnostic("analysis_success", {
      ...requestDiagnostics,
      provider: response.provider,
      fitScore: response.fitScore,
      geminiApiStatus: "ok",
    });

    return NextResponse.json(response);
  } catch (error) {
    const snippet = safeErrorSnippet(error);
    const classified = classifyAnalysisFailure(error);
    const mapped = messageForAnalysisFailureCode(classified.code);

    const jobId = parsedBody.selectedJob?.jobId ?? "";
    const diagnostics = buildRequestDiagnostics({
      jobId,
      body: parsedBody,
      hasResume: isResumeContext(parsedBody.resumeContext),
      geminiConfigured: hasGeminiKey,
      geminiApiStatus: snippet,
    });

    logAnalysisError("analysis_failed", error, {
      ...diagnostics,
      code: classified.code,
      retryable: mapped.retryable,
      snippet,
      responseParseFailure: classified.code === "response_parse_error",
    });

    return NextResponse.json(
      {
        error: mapped.message,
        code: classified.code,
        retryable: mapped.retryable,
      },
      { status: mapped.retryable ? 503 : 500 },
    );
  }
}
