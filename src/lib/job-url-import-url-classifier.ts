export type JobUrlPageKind =
  | "job_posting"
  | "search_results"
  | "login_or_feed"
  | "company_listing"
  | "unknown";

export function isLinkedInHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "linkedin.com" || normalized.endsWith(".linkedin.com");
}

export function isIndeedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "indeed.com" || normalized.endsWith(".indeed.com");
}

/** Classify URL shape to distinguish job posts from search/list/login pages. */
export function classifyJobUrlPage(hostname: string, url: string): JobUrlPageKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unknown";
  }

  const host = hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();

  if (isLinkedInHost(host)) {
    if (
      path.includes("/login") ||
      path.includes("/authwall") ||
      path.includes("/checkpoint") ||
      path.includes("/uas/")
    ) {
      return "login_or_feed";
    }
    if (
      path.includes("/jobs/collections") ||
      path.includes("/jobs/search") ||
      path.includes("/jobs/recommended") ||
      path === "/feed" ||
      path.startsWith("/feed/")
    ) {
      return "search_results";
    }
    return "unknown";
  }

  if (isIndeedHost(host)) {
    if (
      path.includes("/viewjob") ||
      search.includes("jk=") ||
      path.includes("/rc/clk") ||
      path.includes("/pagead/")
    ) {
      return "job_posting";
    }
    if (
      path === "/jobs" ||
      (path.startsWith("/jobs/") && !path.includes("viewjob")) ||
      search.includes("q=") ||
      search.includes("l=") ||
      path.includes("/q-")
    ) {
      return "search_results";
    }
    if (path.includes("/cmp/") || path.includes("/company/")) {
      return "company_listing";
    }
    return "unknown";
  }

  return "unknown";
}

export function looksLikeSearchResultsPage(hostname: string, url: string): boolean {
  const kind = classifyJobUrlPage(hostname, url);
  return kind === "search_results" || kind === "login_or_feed" || kind === "company_listing";
}
