import { NextResponse } from "next/server";
import { analyzeSelectedJob, type AnalyzeSelectedJobInput, type ProviderConfigState } from "@/lib/ai";

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
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    console.log(
      "[single-job-analysis] GEMINI_API_KEY loaded:",
      Boolean(geminiApiKey && geminiApiKey.trim().length > 0),
    );

    const body = (await request.json()) as Partial<AnalyzeSelectedJobRequestBody>;
    console.log("API RECEIVED:", body);
    if (!body.selectedJob?.jobId || !body.selectedJob?.title || !body.selectedJob?.company) {
      return NextResponse.json({ error: "Selected job context is required." }, { status: 400 });
    }
    if (!body.selectedJob.description?.trim()) {
      return NextResponse.json({ error: "Selected job description is required." }, { status: 400 });
    }
    const resumeContext = body.resumeContext;
    if (!isResumeContext(resumeContext)) {
      return NextResponse.json({ error: "Resume context is required." }, { status: 400 });
    }

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
    return NextResponse.json(response);
  } catch (error) {
    console.error("ANALYSIS ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
