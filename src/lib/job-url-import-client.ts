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
  if (code === "blocked" || code === "unsupported_page") {
    return "unsupported";
  }
  return "import_failure";
}
