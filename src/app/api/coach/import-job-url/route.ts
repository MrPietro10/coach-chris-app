import { NextResponse } from "next/server";
import { importJobDescriptionFromUrl } from "@/lib/job-url-import-service";
import {
  getUserFacingJobUrlImportError,
  JOB_URL_IMPORT_FAILURE_MESSAGE,
  type JobUrlImportErrorCode,
} from "@/lib/job-url-import-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportJobUrlRequestBody = {
  url?: string;
};

function statusForCode(code: JobUrlImportErrorCode): number {
  switch (code) {
    case "invalid_url":
    case "unsupported_scheme":
    case "private_host":
      return 400;
    case "payload_too_large":
      return 413;
    case "blocked":
    case "unsupported_page":
      return 422;
    default:
      return 502;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportJobUrlRequestBody;
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json(
        {
          error: "Job posting URL is required.",
          code: "invalid_url" satisfies JobUrlImportErrorCode,
          retryable: false,
        },
        { status: 400 },
      );
    }

    const result = await importJobDescriptionFromUrl(url);

    if (!result.ok) {
      const copy = getUserFacingJobUrlImportError(result.code);
      if (process.env.NODE_ENV !== "production") {
        console.warn("[import-job-url] import_failed", { code: result.code });
      }
      return NextResponse.json(
        {
          error: copy.message,
          title: copy.title,
          hint: copy.hint ?? JOB_URL_IMPORT_FAILURE_MESSAGE,
          code: result.code,
          retryable: result.code === "fetch_failed" || result.code === "empty_extraction",
        },
        { status: statusForCode(result.code) },
      );
    }

    return NextResponse.json({
      description: result.description,
      suggestedTitle: result.suggestedTitle,
      sourceUrl: result.sourceUrl,
      provider: result.provider,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[import-job-url] unexpected_error", error);
    }
    return NextResponse.json(
      {
        error: JOB_URL_IMPORT_FAILURE_MESSAGE,
        code: "fetch_failed" satisfies JobUrlImportErrorCode,
        retryable: true,
      },
      { status: 500 },
    );
  }
}
