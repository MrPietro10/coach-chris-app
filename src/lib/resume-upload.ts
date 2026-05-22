export const SUPPORTED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

export const SUPPORTED_RESUME_LABEL = "PDF, DOC, DOCX";

export const PARSEABLE_RESUME_EXTENSIONS = [".pdf", ".docx"] as const;

export const PARSEABLE_RESUME_LABEL = "PDF, DOCX";

export const LEGACY_DOC_EXTENSION = ".doc";

export const MAX_RESUME_FILE_SIZE_BYTES = 8 * 1024 * 1024;

/** Client-side resume upload + parse flow status. */
export type ResumeParseFlowStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "parse_success"
  | "parse_failure"
  | "unsupported"
  | "resume_ready";

/** @deprecated Use ResumeParseFlowStatus */
export type ResumeUploadStatus = ResumeParseFlowStatus;

function getExtension(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function hasSupportedExtension(filename: string): boolean {
  return SUPPORTED_RESUME_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
}

export function isLegacyDocFile(filename: string): boolean {
  return getExtension(filename) === LEGACY_DOC_EXTENSION;
}

export function isParseableResumeFile(filename: string): boolean {
  return PARSEABLE_RESUME_EXTENSIONS.some((ext) => getExtension(filename) === ext);
}

export function validateResumeUploadFile(file: File): string | null {
  if (!hasSupportedExtension(file.name)) {
    return `Unsupported file type. Use ${SUPPORTED_RESUME_LABEL}.`;
  }
  if (file.size <= 0) {
    return "This file appears empty. Try another file.";
  }
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    return "This file is too large for beta upload. Keep it under 8MB.";
  }
  return null;
}

export const LEGACY_DOC_MESSAGE =
  "Legacy .doc files are not supported yet. Please convert to PDF or DOCX and try again.";

export const PARSE_FAILURE_MESSAGE =
  "We couldn't fully read this resume. Please paste or edit the content manually.";
