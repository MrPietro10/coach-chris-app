import { NextResponse } from "next/server";
import {
  logParseResumeDiagnostic,
  logParseResumeError,
  parseResumeBuffer,
} from "@/lib/resume-parse";
import type { ResumeParseErrorCode } from "@/lib/resume-parse-messages";
import { MAX_RESUME_FILE_SIZE_BYTES } from "@/lib/resume-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FORM_BODY_BYTES = MAX_RESUME_FILE_SIZE_BYTES + 512 * 1024;

function statusForCode(code: ResumeParseErrorCode): number {
  switch (code) {
    case "unsupported":
      return 415;
    case "too_large":
      return 413;
    case "missing_file":
      return 400;
    default:
      return 422;
  }
}

export async function POST(request: Request) {
  const runtimeLabel = "nodejs";

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_FORM_BODY_BYTES) {
      logParseResumeDiagnostic("validation_failed", {
        stage: "upload",
        code: "too_large",
        contentLength,
        runtime: runtimeLabel,
      });
      return NextResponse.json(
        {
          error: "This file is too large for beta upload. Keep it under 8MB.",
          title: "File too large",
          code: "too_large",
          stage: "validation",
        },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      logParseResumeDiagnostic("validation_failed", {
        stage: "upload",
        code: "missing_file",
        runtime: runtimeLabel,
      });
      return NextResponse.json(
        {
          error: "Resume file is required.",
          title: "No file received",
          code: "missing_file",
          stage: "upload",
        },
        { status: 400 },
      );
    }

    const mimeType = fileValue.type || "unknown";

    logParseResumeDiagnostic("upload_received", {
      fileName: fileValue.name,
      fileSize: fileValue.size,
      mimeType,
      runtime: runtimeLabel,
    });

    const arrayBuffer = await fileValue.arrayBuffer();

    logParseResumeDiagnostic("buffer_created", {
      fileName: fileValue.name,
      fileSize: fileValue.size,
      mimeType,
      arrayBufferBytes: arrayBuffer.byteLength,
      runtime: runtimeLabel,
    });

    if (fileValue.size > 0 && arrayBuffer.byteLength === 0) {
      logParseResumeError("buffer_empty", new Error("ArrayBuffer empty after upload"), {
        fileName: fileValue.name,
        fileSize: fileValue.size,
        mimeType,
      });
      return NextResponse.json(
        {
          error: "Upload received but file data was empty.",
          title: "Upload failed",
          code: "parse_failed",
          stage: "upload",
        },
        { status: 422 },
      );
    }

    const buffer = Buffer.from(arrayBuffer);

    logParseResumeDiagnostic("parse_started", {
      fileName: fileValue.name,
      bufferBytes: buffer.length,
      mimeType,
      runtime: runtimeLabel,
    });

    const result = await parseResumeBuffer(buffer, fileValue.name);

    if (!result.ok) {
      logParseResumeDiagnostic("parse_failed", {
        fileName: fileValue.name,
        bufferBytes: buffer.length,
        code: result.code,
        stage: result.stage,
        diagnostic: result.diagnostic,
        runtime: runtimeLabel,
      });
      return NextResponse.json(
        {
          error: result.error,
          title: result.title,
          hint: result.hint,
          code: result.code,
          stage: result.stage,
        },
        { status: statusForCode(result.code) },
      );
    }

    logParseResumeDiagnostic("parse_success", {
      fileName: fileValue.name,
      fileType: result.fileType,
      bufferBytes: buffer.length,
      mimeType,
      rawTextLength: result.fields.rawText.length,
      summaryLength: result.fields.summary.length,
      skillsLength: result.fields.skills.length,
      highlightsLength: result.fields.highlights.length,
      educationLength: result.fields.education.length,
      hasWarning: Boolean(result.warning),
      runtime: runtimeLabel,
    });

    return NextResponse.json({
      fileType: result.fileType,
      fileName: fileValue.name,
      summary: result.fields.summary,
      skills: result.fields.skills,
      highlights: result.fields.highlights,
      education: result.fields.education,
      rawText: result.fields.rawText,
      candidateName: result.fields.candidateName,
      contactLine: result.fields.contactLine,
      extraSections: result.fields.extraSections ?? [],
      warning: result.warning,
      code: "success",
    });
  } catch (error) {
    logParseResumeError("unexpected_error", error, { runtime: runtimeLabel });
    return NextResponse.json(
      {
        error: "We couldn't fully read this resume.",
        title: "Parsing failed",
        hint: "Try re-exporting as PDF or DOCX, or paste your resume below.",
        code: "parse_failed",
        stage: "parser",
      },
      { status: 500 },
    );
  }
}
