import type { JobUrlImportDiagnostics } from "@/lib/job-url-import-diagnostics";
import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";

export type JobUrlImportFlowStatus =
  | "idle"
  | "importing"
  | "import_success"
  | "import_failure"
  | "unsupported";

export type JobUrlImportStatusDetail = {
  title: string | null;
  message: string | null;
  hint: string | null;
};

export function flowStatusFromImportCode(code: JobUrlImportErrorCode): JobUrlImportFlowStatus {
  if (
    code === "linkedin_blocked" ||
    code === "blocked" ||
    code === "unsupported_page" ||
    code === "unsupported_host" ||
    code === "indeed_search_page" ||
    code === "indeed_no_description" ||
    code === "page_protected"
  ) {
    return "unsupported";
  }
  return "import_failure";
}

export function logImportDiagnosticsInDev(diagnostics: JobUrlImportDiagnostics | undefined): void {
  if (process.env.NODE_ENV === "production" || !diagnostics) {
    return;
  }
  console.info("[job-url-import] client diagnostics", diagnostics);
}
