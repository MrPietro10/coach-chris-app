import { NextResponse } from "next/server";
import {
  generateTailoredResumeDraft,
  type GenerateTailoredResumeDraftInput,
  type ProviderConfigState,
} from "@/lib/ai";
import {
  classifyTailoredDraftFailure,
  messageForTailoredDraftFailureCode,
} from "@/lib/tailored-draft-flow-messages";
import { estimateResumeTextLength } from "@/lib/analysis-request";
import {
  estimateTailoredDraftPayloadChars,
  safeTailoredDraftErrorSnippet,
  logTailoredDraftDiagnostic,
  logTailoredDraftError,
  validateTailoredDraftRequest,
} from "@/lib/tailored-draft-request";
import { normalizeTailoredDraftPayload } from "@/lib/tailored-resume-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TailoredResumeDraftRequestBody = {
  selectedJob: GenerateTailoredResumeDraftInput["selectedJob"];
  resumeContext: GenerateTailoredResumeDraftInput["resumeContext"];
  analysisContext: GenerateTailoredResumeDraftInput["analysisContext"];
  sourceResume?: GenerateTailoredResumeDraftInput["sourceResume"];
  providerConfig?: ProviderConfigState;
};

function hasResumeEvidence(
  resumeContext: TailoredResumeDraftRequestBody["resumeContext"] | undefined,
): boolean {
  if (!resumeContext) return false;
  return (
    resumeContext.summary.trim().length > 0 ||
    resumeContext.skills.length > 0 ||
    resumeContext.experienceHighlights.length > 0 ||
    resumeContext.educationEntries.length > 0
  );
}

function buildRequestDiagnostics(input: {
  jobId: string;
  body: Partial<TailoredResumeDraftRequestBody>;
  geminiConfigured: boolean;
  geminiApiStatus?: string;
  payloadCharsEstimate?: number;
}): Record<string, unknown> {
  const resumeContext = input.body.resumeContext;
  const description = input.body.selectedJob?.description ?? "";

  return {
    selectedJobId: input.jobId || null,
    selectedJobTitle: input.body.selectedJob?.title ?? null,
    activeResumeId: input.body.sourceResume?.id ?? null,
    activeResumeName: input.body.sourceResume?.name ?? null,
    resumeTextLength: resumeContext ? estimateResumeTextLength(resumeContext) : 0,
    jobDescriptionLength: description.length,
    payloadCharsEstimate: input.payloadCharsEstimate ?? null,
    geminiConfigured: input.geminiConfigured,
    geminiApiStatus: input.geminiApiStatus ?? null,
  };
}

function draftFailureResponse(
  code: Parameters<typeof messageForTailoredDraftFailureCode>[0],
  options?: { status?: number; diagnostics?: Record<string, unknown> },
) {
  const mapped = messageForTailoredDraftFailureCode(code);
  if (options?.diagnostics) {
    logTailoredDraftDiagnostic("draft_failure_response", {
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
  let parsedBody: Partial<TailoredResumeDraftRequestBody> = {};

  try {
    logTailoredDraftDiagnostic("request_received", {
      runtime: "nodejs",
      geminiConfigured: hasGeminiKey,
    });

    parsedBody = (await request.json()) as Partial<TailoredResumeDraftRequestBody>;
    const jobId = parsedBody.selectedJob?.jobId ?? "";
    const resumeContext = parsedBody.resumeContext;
    const jobDescriptionLength = parsedBody.selectedJob?.description?.length ?? 0;
    const resumeTextLength = resumeContext ? estimateResumeTextLength(resumeContext) : 0;
    const payloadCharsEstimate =
      parsedBody.selectedJob?.description && resumeContext
        ? estimateTailoredDraftPayloadChars({
            jobDescription: parsedBody.selectedJob.description,
            resumeContext,
            jobTitle: parsedBody.selectedJob.title,
            jobCompany: parsedBody.selectedJob.company,
          })
        : undefined;

    const requestDiagnostics = buildRequestDiagnostics({
      jobId,
      body: parsedBody,
      geminiConfigured: hasGeminiKey,
      payloadCharsEstimate,
    });

    logTailoredDraftDiagnostic("request_parsed", {
      ...requestDiagnostics,
      hasResume: hasResumeEvidence(resumeContext),
      hasAnalysisContext: Boolean(parsedBody.analysisContext),
    });

    if (!parsedBody.selectedJob?.jobId || !parsedBody.selectedJob.title || !parsedBody.selectedJob.company) {
      return draftFailureResponse("missing_job", {
        status: 400,
        diagnostics: requestDiagnostics,
      });
    }

    if (!parsedBody.selectedJob.description?.trim()) {
      return draftFailureResponse("missing_job", {
        status: 400,
        diagnostics: { ...requestDiagnostics, jobDescriptionLength },
      });
    }

    if (!resumeContext || !hasResumeEvidence(resumeContext)) {
      return draftFailureResponse("missing_resume", {
        status: 400,
        diagnostics: { ...requestDiagnostics, resumeTextLength },
      });
    }

    if (!parsedBody.analysisContext) {
      return draftFailureResponse("unknown_error", {
        status: 400,
        diagnostics: requestDiagnostics,
      });
    }

    const payloadCheck = validateTailoredDraftRequest({
      jobDescription: parsedBody.selectedJob.description,
      resumeContext,
      jobTitle: parsedBody.selectedJob.title,
      jobCompany: parsedBody.selectedJob.company,
    });

    if (!payloadCheck.ok) {
      logTailoredDraftDiagnostic("validation_failed", {
        ...requestDiagnostics,
        code: payloadCheck.code,
      });
      return draftFailureResponse(payloadCheck.code, {
        status: payloadCheck.code === "prompt_too_large" ? 413 : 400,
        diagnostics: requestDiagnostics,
      });
    }

    if (!hasGeminiKey || geminiApiKey === "your_real_key_here") {
      logTailoredDraftDiagnostic("configuration_missing", requestDiagnostics);
      return draftFailureResponse("unknown_error", {
        status: 503,
        diagnostics: requestDiagnostics,
      });
    }

    logTailoredDraftDiagnostic("draft_started", {
      ...requestDiagnostics,
      payloadChars: payloadCheck.payloadChars,
    });

    const response = await generateTailoredResumeDraft(
      {
        selectedJob: parsedBody.selectedJob,
        resumeContext,
        analysisContext: parsedBody.analysisContext,
        sourceResume: parsedBody.sourceResume,
      },
      { providerConfig: parsedBody.providerConfig },
    );

    const normalized = normalizeTailoredDraftPayload(response);

    logTailoredDraftDiagnostic("draft_success", {
      ...requestDiagnostics,
      provider: response.provider,
      geminiApiStatus: "ok",
    });

    return NextResponse.json({
      provider: response.provider,
      draft: normalized,
    });
  } catch (error) {
    const snippet = safeTailoredDraftErrorSnippet(error);
    const classified = classifyTailoredDraftFailure(error);
    const mapped = messageForTailoredDraftFailureCode(classified.code);

    const jobId = parsedBody.selectedJob?.jobId ?? "";
    const diagnostics = buildRequestDiagnostics({
      jobId,
      body: parsedBody,
      geminiConfigured: hasGeminiKey,
      geminiApiStatus: snippet,
    });

    logTailoredDraftError("draft_failed", error, {
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
