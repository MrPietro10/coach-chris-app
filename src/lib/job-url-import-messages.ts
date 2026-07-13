export type JobUrlImportErrorCode =
  | "invalid_url"
  | "unsupported_scheme"
  | "private_host"
  | "unsupported_host"
  | "linkedin_blocked"
  | "indeed_search_page"
  | "indeed_no_description"
  | "page_protected"
  | "fetch_failed"
  | "blocked"
  | "unsupported_page"
  | "empty_extraction"
  | "payload_too_large"
  | "provider_not_configured";

export const JOB_URL_IMPORT_HELPER_COPY =
  "Works best with public company career pages like Greenhouse, Lever, Ashby, Workday, and company websites. Some job boards like LinkedIn or Indeed may block imports. If that happens, paste the job description manually.";

export const JOB_URL_IMPORT_FAILURE_MODAL_TITLE = "We couldn't import this job link";

export const JOB_URL_IMPORT_FAILURE_MODAL_MESSAGE =
  "Some job boards, including LinkedIn, block automated imports. Copy the job description from the posting and paste it below.";

export const JOB_URL_IMPORT_LINKEDIN_FAILURE_MODAL_MESSAGE =
  "LinkedIn did not allow Coach Chris to read this page. Paste the job description manually.";

export const JOB_URL_IMPORT_FAILURE_MESSAGE =
  "We couldn't import this job post. Try pasting the description manually.";

export const JOB_URL_IMPORT_FAILURE_INLINE_HINT =
  "Paste the job description in the manual section below.";

export function getJobUrlImportFailureModalMessage(code: JobUrlImportErrorCode): string {
  if (code === "linkedin_blocked") {
    return JOB_URL_IMPORT_LINKEDIN_FAILURE_MODAL_MESSAGE;
  }
  return JOB_URL_IMPORT_FAILURE_MODAL_MESSAGE;
}

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
    case "linkedin_blocked":
      return {
        title: "LinkedIn not supported",
        message:
          "LinkedIn did not allow Coach Chris to read this page. Paste the job description manually.",
        hint: JOB_URL_IMPORT_FAILURE_INLINE_HINT,
      };
    case "indeed_search_page":
      return {
        title: "Indeed link needs a specific job",
        message:
          "Indeed did not expose a readable job description from this link. Open a specific job post or paste the description manually.",
        hint: "Use a URL that opens one job posting (often includes viewjob), not a search results page.",
      };
    case "indeed_no_description":
      return {
        title: "Indeed description unavailable",
        message:
          "Indeed did not expose a readable job description from this link. Open a specific job post or paste the description manually.",
        hint: "Open the full job posting in your browser, copy the description, and paste it manually.",
      };
    case "page_protected":
    case "blocked":
    case "unsupported_page":
      return {
        title: "Page could not be read",
        message:
          "This page may be private, protected, or JavaScript-rendered. Paste the description manually.",
        hint: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
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
    case "unsupported_host":
      return {
        title: "Unsupported job site",
        message:
          "This job site cannot be imported directly in beta. Paste the description manually, or use an approved connector when available.",
        hint: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
    case "payload_too_large":
      return {
        title: "Page too large",
        message: "This job page is too large to import in beta.",
        hint: JOB_URL_IMPORT_FAILURE_MESSAGE,
      };
    case "empty_extraction":
      return {
        title: "Not enough description text",
        message:
          "We couldn't extract enough job description text from this page. Paste the description manually.",
        hint: JOB_URL_IMPORT_FAILURE_MESSAGE,
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

/** Map internal/legacy codes to user-facing failure codes where helpful. */
export function normalizeImportFailureCode(
  code: JobUrlImportErrorCode,
  context?: { hostname?: string },
): JobUrlImportErrorCode {
  if (code === "linkedin_blocked") return code;
  if (code === "indeed_search_page" || code === "indeed_no_description") return code;
  if (code === "page_protected") return code;

  const host = context?.hostname?.toLowerCase() ?? "";
  if (code === "unsupported_host" && (host.includes("linkedin.com"))) {
    return "linkedin_blocked";
  }

  if (code === "blocked" || code === "unsupported_page") {
    return "page_protected";
  }

  if (code === "empty_extraction" && host.includes("indeed.com")) {
    return "indeed_no_description";
  }

  return code;
}
