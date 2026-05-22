export type JobUrlImportErrorCode =
  | "invalid_url"
  | "unsupported_scheme"
  | "private_host"
  | "fetch_failed"
  | "blocked"
  | "unsupported_page"
  | "empty_extraction"
  | "payload_too_large"
  | "provider_not_configured";

export const JOB_URL_IMPORT_FAILURE_MESSAGE =
  "We couldn't import this job post. Try pasting the description manually.";

export const JOB_URL_IMPORT_UNSUPPORTED_MESSAGE =
  "This page looks private or unsupported. Paste the description manually.";

export const JOB_URL_IMPORT_SUCCESS_MESSAGE =
  "Job description imported. Review and edit before analyzing.";

export function getUserFacingJobUrlImportError(code: JobUrlImportErrorCode): {
  title: string;
  message: string;
  hint?: string;
} {
  switch (code) {
    case "invalid_url":
      return {
        title: "Invalid link",
        message: "Enter a valid public job posting URL (http or https).",
        hint: "Paste the description manually if the link is not public.",
      };
    case "unsupported_scheme":
      return {
        title: "Unsupported link",
        message: "Only http and https job links are supported.",
      };
    case "private_host":
      return {
        title: "Unsupported link",
        message: "This URL points to a private or local address.",
        hint: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
    case "payload_too_large":
      return {
        title: "Page too large",
        message: "This job page is too large to import in beta.",
        hint: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
    case "blocked":
    case "unsupported_page":
      return {
        title: "Private or protected page",
        message: JOB_URL_IMPORT_UNSUPPORTED_MESSAGE,
      };
    case "empty_extraction":
      return {
        title: "No description found",
        message: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
    case "provider_not_configured":
      return {
        title: "Import unavailable",
        message: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
    default:
      return {
        title: "Import failed",
        message: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
  }
}
