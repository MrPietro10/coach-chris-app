import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";
import type { JobUrlPageKind } from "@/lib/job-url-import-url-classifier";

export type JobUrlImportDiagnostics = {
  urlHost: string;
  urlPath?: string;
  httpStatus?: number;
  contentType?: string | null;
  fetchedHtmlLength?: number;
  extractedTextLength?: number;
  failureReason?: string;
  urlPageKind?: JobUrlPageKind;
  looksLikeSearchResults?: boolean;
  errorCode?: JobUrlImportErrorCode;
};

export function buildJobUrlImportDiagnostics(
  partial: JobUrlImportDiagnostics,
): JobUrlImportDiagnostics {
  return partial;
}

export function logJobUrlImportFailureDiagnostics(diagnostics: JobUrlImportDiagnostics): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.info("[job-url-import] import_failed", diagnostics);
}
