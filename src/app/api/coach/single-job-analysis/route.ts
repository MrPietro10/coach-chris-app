import { NextResponse } from "next/server";
import { analyzeSelectedJob, type AnalyzeSelectedJobInput, type ProviderConfigState } from "@/lib/ai";

type AnalyzeSelectedJobRequestBody = {
  selectedJob: AnalyzeSelectedJobInput["selectedJob"];
  resumeContext: AnalyzeSelectedJobInput["resumeContext"];
  fitContext?: AnalyzeSelectedJobInput["fitContext"];
  optimizeContext?: AnalyzeSelectedJobInput["optimizeContext"];
  providerConfig?: ProviderConfigState;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AnalyzeSelectedJobRequestBody>;
    console.log("API RECEIVED:", body);
    if (!body.selectedJob?.jobId || !body.selectedJob?.title || !body.selectedJob?.company) {
      return NextResponse.json({ error: "Selected job context is required." }, { status: 400 });
    }
    if (!body.selectedJob.description?.trim()) {
      return NextResponse.json({ error: "Selected job description is required." }, { status: 400 });
    }
    if (!body.resumeContext?.summary?.trim()) {
      return NextResponse.json({ error: "Resume summary is required." }, { status: 400 });
    }

    const response = await analyzeSelectedJob(
      {
        selectedJob: body.selectedJob,
        resumeContext: body.resumeContext,
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
