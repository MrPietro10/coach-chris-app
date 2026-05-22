export type ResumeParseErrorCode =
  | "unsupported"
  | "too_large"
  | "empty_file"
  | "empty_extraction"
  | "parser_exception"
  | "parse_failed"
  | "missing_file"
  | "network_error";

export type ResumeParseFailureStage = "validation" | "upload" | "extraction" | "parser";

export function getUserFacingParseError(
  code: ResumeParseErrorCode,
  options?: { fileType?: "pdf" | "docx" },
): { title: string; message: string; hint?: string } {
  switch (code) {
    case "unsupported":
      return {
        title: "Unsupported file",
        message: "This file type cannot be parsed automatically.",
        hint: "Try re-exporting as PDF or DOCX, or paste your resume below.",
      };
    case "too_large":
      return {
        title: "File too large",
        message: "This file is too large for beta upload. Keep it under 8MB.",
        hint: "Try a smaller export or paste your resume manually.",
      };
    case "empty_file":
      return {
        title: "Empty file",
        message: "This file appears empty.",
        hint: "Try another file or paste your resume below.",
      };
    case "empty_extraction":
      return {
        title: "No text found",
        message:
          options?.fileType === "pdf"
            ? "We couldn't fully read this PDF."
            : "We couldn't read any text from this file.",
        hint: "This file may be image-based or unsupported. Try re-exporting as PDF or DOCX, or paste your resume below.",
      };
    case "parser_exception":
      return {
        title: "Parsing error",
        message:
          options?.fileType === "pdf"
            ? "We couldn't fully read this PDF."
            : "We couldn't fully read this resume file.",
        hint: "Try re-exporting as PDF or DOCX, or paste your resume below.",
      };
    case "missing_file":
      return {
        title: "No file received",
        message: "No resume file was uploaded.",
        hint: "Choose a file and try again.",
      };
    case "network_error":
      return {
        title: "Upload failed",
        message: "We couldn't reach the server to parse your resume.",
        hint: "Check your connection and try again, or paste your resume below.",
      };
    default:
      return {
        title: "Parsing failed",
        message: "We couldn't fully read this resume.",
        hint: "Try re-exporting as PDF or DOCX, or paste your resume below.",
      };
  }
}

export const PARSE_SUCCESS_MESSAGE =
  "Resume parsed successfully. Review and edit before analysis.";

export const PARSE_PARTIAL_WARNING =
  "We extracted text from your file, but formatting may need cleanup. Review the fields below before saving.";

export const RESUME_READY_MESSAGE =
  "Resume saved — this version is active for job analysis.";

export const PARSE_REVIEW_NOT_SAVED_MESSAGE =
  "Parsed resume loaded below. Save for analysis when you are ready — analysis uses your saved version, not the raw upload.";
