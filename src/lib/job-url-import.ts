import {
  extractJobDescriptionFromHtml,
  type JobHtmlExtractionResult,
} from "@/lib/job-url-import-extractors";
import {
  buildJobUrlImportDiagnostics,
  logJobUrlImportFailureDiagnostics,
  type JobUrlImportDiagnostics,
} from "@/lib/job-url-import-diagnostics";
import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";
import {
  classifyJobUrlPage,
  isIndeedHost,
  isLinkedInHost,
  looksLikeSearchResultsPage,
} from "@/lib/job-url-import-url-classifier";

export const MAX_JOB_PAGE_BYTES = 1_500_000;
export const JOB_URL_FETCH_TIMEOUT_MS = 15_000;

const BLOCKED_CONTENT_PATTERNS = [
  /sign\s*in\s+to\s+(view|see|apply)/i,
  /log\s*in\s+to\s+(view|see|continue|apply)/i,
  /authwall/i,
  /security\s+verification/i,
  /captcha/i,
  /access\s+denied/i,
  /please\s+enable\s+cookies/i,
  /subscribers?\s+only/i,
  /members?\s+only/i,
  /this\s+content\s+is\s+not\s+available/i,
];

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
  /\.local$/i,
];

export type ValidatedJobUrl = {
  href: string;
  hostname: string;
};

export type JobUrlFetchResult = {
  html: string;
  finalUrl: string;
  contentType: string | null;
  httpStatus: number;
};

export type JobUrlImportDiagnosticEvent =
  | "validation_failed"
  | "fetch_started"
  | "fetch_failed"
  | "fetch_completed"
  | "blocked_detected"
  | "extract_started"
  | "extract_empty"
  | "extract_success"
  | "provider_skipped"
  | "url_classified";

export function logJobUrlImportDiagnostic(
  event: JobUrlImportDiagnosticEvent,
  details: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.info(`[job-url-import] ${event}`, details);
}

function logFailureWithDiagnostics(diagnostics: JobUrlImportDiagnostics): void {
  logJobUrlImportFailureDiagnostics(diagnostics);
}

export function validatePublicJobUrl(rawUrl: string): ValidatedJobUrl | JobUrlImportErrorCode {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "invalid_url";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "invalid_url";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "unsupported_scheme";
  }

  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return "private_host";
  }

  if (hostname === "0.0.0.0" || hostname.endsWith(".internal")) {
    return "private_host";
  }

  if (isLinkedInHost(hostname)) {
    logFailureWithDiagnostics(
      buildJobUrlImportDiagnostics({
        urlHost: hostname,
        urlPath: parsed.pathname,
        failureReason: "linkedin_host_blocked",
        urlPageKind: classifyJobUrlPage(hostname, parsed.toString()),
        looksLikeSearchResults: looksLikeSearchResultsPage(hostname, parsed.toString()),
        errorCode: "linkedin_blocked",
      }),
    );
    return "linkedin_blocked";
  }

  if (isIndeedHost(hostname) && looksLikeSearchResultsPage(hostname, parsed.toString())) {
    logFailureWithDiagnostics(
      buildJobUrlImportDiagnostics({
        urlHost: hostname,
        urlPath: parsed.pathname,
        failureReason: "indeed_search_or_listing_url",
        urlPageKind: classifyJobUrlPage(hostname, parsed.toString()),
        looksLikeSearchResults: true,
        errorCode: "indeed_search_page",
      }),
    );
    return "indeed_search_page";
  }

  if (isDirectImportBlockedHost(hostname)) {
    return "unsupported_host";
  }

  return { href: parsed.toString(), hostname };
}

/** Hosts that require an approved connector (Firecrawl, Apify, etc.) — never fetched in V1. */
export function isDirectImportBlockedHost(hostname: string): boolean {
  return isLinkedInHost(hostname);
}

export function detectBlockedOrPrivatePage(input: {
  html: string;
  hostname: string;
  status: number;
  extractedLength: number;
}): JobUrlImportErrorCode | null {
  if (input.status === 401 || input.status === 403 || input.status === 407) {
    return "page_protected";
  }

  const htmlSample = input.html.slice(0, 120_000).toLowerCase();
  const matchedPattern = BLOCKED_CONTENT_PATTERNS.find((pattern) => pattern.test(htmlSample));
  if (matchedPattern) {
    return "page_protected";
  }

  if (input.extractedLength < MIN_JOB_DESCRIPTION_CHARS) {
    const hasLoginShell =
      htmlSample.includes("login") &&
      (htmlSample.includes("password") || htmlSample.includes("sign in"));
    if (hasLoginShell) {
      return "page_protected";
    }
  }

  return null;
}

export const MIN_JOB_DESCRIPTION_CHARS = 200;

export async function fetchPublicJobPageHtml(url: string): Promise<
  | JobUrlFetchResult
  | { code: JobUrlImportErrorCode; status?: number; contentType?: string | null }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JOB_URL_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "CoachChrisJobImport/1.0 (+beta; public job pages only)",
      },
    });

    const contentType = response.headers.get("content-type");
    const urlHost = safeHostFromUrl(url);
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      logFailureWithDiagnostics(
        buildJobUrlImportDiagnostics({
          urlHost: urlHost ?? "unknown",
          httpStatus: response.status,
          contentType,
          failureReason: "non_html_content_type",
          errorCode: "page_protected",
        }),
      );
      return { code: "page_protected", status: response.status, contentType };
    }

    if (!response.ok) {
      const code =
        response.status === 401 || response.status === 403 || response.status === 407
          ? "page_protected"
          : "fetch_failed";
      logFailureWithDiagnostics(
        buildJobUrlImportDiagnostics({
          urlHost: urlHost ?? "unknown",
          httpStatus: response.status,
          contentType,
          failureReason: code === "page_protected" ? "http_auth_or_forbidden" : "http_error",
          errorCode: code,
        }),
      );
      return { code, status: response.status, contentType };
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_JOB_PAGE_BYTES) {
      return { code: "payload_too_large", status: response.status };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { code: "fetch_failed", status: response.status };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_JOB_PAGE_BYTES) {
        await reader.cancel();
        return { code: "payload_too_large", status: response.status };
      }
      chunks.push(value);
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      concatenateUint8Arrays(chunks),
    );

    logJobUrlImportDiagnostic("fetch_completed", {
      urlHost: urlHost ?? "unknown",
      httpStatus: response.status,
      contentType,
      fetchedHtmlLength: html.length,
      finalUrl: response.url || url,
    });

    return {
      html,
      finalUrl: response.url || url,
      contentType,
      httpStatus: response.status,
    };
  } catch (error) {
    const urlHost = safeHostFromUrl(url);
    logFailureWithDiagnostics(
      buildJobUrlImportDiagnostics({
        urlHost: urlHost ?? "unknown",
        failureReason: "fetch_exception",
        errorCode: "fetch_failed",
      }),
    );
    logJobUrlImportDiagnostic("fetch_failed", {
      urlHost,
      error: error instanceof Error ? error.name : "unknown",
    });
    return { code: "fetch_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function concatenateUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function safeHostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function extractFromFetchedHtml(
  html: string,
  pageUrl: string,
  hostname: string,
  httpStatus = 200,
): {
  ok: true;
  description: string;
  suggestedTitle: string | null;
  extractor: JobHtmlExtractionResult["extractor"];
} | { ok: false; code: JobUrlImportErrorCode } {
  logJobUrlImportDiagnostic("extract_started", {
    urlHost: hostname,
    htmlLength: html.length,
  });

  const extracted = extractJobDescriptionFromHtml(html, pageUrl);
  const blocked = detectBlockedOrPrivatePage({
    html,
    hostname,
    status: httpStatus,
    extractedLength: extracted.description.length,
  });

  const pageKind = classifyJobUrlPage(hostname, pageUrl);
  const searchLike = looksLikeSearchResultsPage(hostname, pageUrl);

  if (blocked) {
    const failureCode =
      isIndeedHost(hostname) && searchLike ? "indeed_search_page" : blocked;
    logFailureWithDiagnostics(
      buildJobUrlImportDiagnostics({
        urlHost: hostname,
        httpStatus,
        fetchedHtmlLength: html.length,
        extractedTextLength: extracted.description.length,
        failureReason: "blocked_or_protected_content",
        urlPageKind: pageKind,
        looksLikeSearchResults: searchLike,
        errorCode: failureCode,
      }),
    );
    return { ok: false, code: failureCode };
  }

  if (isIndeedHost(hostname) && searchLike) {
    logFailureWithDiagnostics(
      buildJobUrlImportDiagnostics({
        urlHost: hostname,
        httpStatus,
        fetchedHtmlLength: html.length,
        extractedTextLength: extracted.description.length,
        failureReason: "indeed_search_results_after_fetch",
        urlPageKind: pageKind,
        looksLikeSearchResults: true,
        errorCode: "indeed_search_page",
      }),
    );
    return { ok: false, code: "indeed_search_page" };
  }

  if (extracted.description.length < MIN_JOB_DESCRIPTION_CHARS) {
    const failureCode = isIndeedHost(hostname) ? "indeed_no_description" : "empty_extraction";
    logFailureWithDiagnostics(
      buildJobUrlImportDiagnostics({
        urlHost: hostname,
        httpStatus,
        fetchedHtmlLength: html.length,
        extractedTextLength: extracted.description.length,
        failureReason: "insufficient_extracted_text",
        urlPageKind: pageKind,
        looksLikeSearchResults: searchLike,
        errorCode: failureCode,
      }),
    );
    return { ok: false, code: failureCode };
  }

  logJobUrlImportDiagnostic("extract_success", {
    urlHost: hostname,
    extractedLength: extracted.description.length,
    extractor: extracted.extractor,
  });

  return {
    ok: true,
    description: extracted.description,
    suggestedTitle: extracted.suggestedTitle,
    extractor: extracted.extractor,
  };
}
