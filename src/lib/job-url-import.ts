import {
  extractJobDescriptionFromHtml,
  type JobHtmlExtractionResult,
} from "@/lib/job-url-import-extractors";
import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";

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
};

export type JobUrlImportDiagnosticEvent =
  | "validation_failed"
  | "fetch_started"
  | "fetch_failed"
  | "blocked_detected"
  | "extract_started"
  | "extract_empty"
  | "extract_success"
  | "provider_skipped";

export function logJobUrlImportDiagnostic(
  event: JobUrlImportDiagnosticEvent,
  details: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.info(`[job-url-import] ${event}`, details);
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

  return { href: parsed.toString(), hostname };
}

function isLinkedInHost(hostname: string): boolean {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}

export function detectBlockedOrPrivatePage(input: {
  html: string;
  hostname: string;
  status: number;
  extractedLength: number;
}): JobUrlImportErrorCode | null {
  if (input.status === 401 || input.status === 403 || input.status === 407) {
    return "blocked";
  }

  const htmlSample = input.html.slice(0, 120_000).toLowerCase();
  const matchedPattern = BLOCKED_CONTENT_PATTERNS.find((pattern) => pattern.test(htmlSample));
  if (matchedPattern) {
    return "blocked";
  }

  if (isLinkedInHost(input.hostname)) {
    const looksLikeLogin =
      htmlSample.includes("authwall") ||
      htmlSample.includes("join linkedin") ||
      htmlSample.includes("sign in") ||
      input.extractedLength < MIN_JOB_DESCRIPTION_CHARS;
    if (looksLikeLogin) {
      return "unsupported_page";
    }
  }

  if (input.extractedLength < MIN_JOB_DESCRIPTION_CHARS) {
    const hasLoginShell =
      htmlSample.includes("login") &&
      (htmlSample.includes("password") || htmlSample.includes("sign in"));
    if (hasLoginShell) {
      return "unsupported_page";
    }
  }

  return null;
}

export const MIN_JOB_DESCRIPTION_CHARS = 200;

export async function fetchPublicJobPageHtml(url: string): Promise<
  | JobUrlFetchResult
  | { code: JobUrlImportErrorCode; status?: number }
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
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      return { code: "unsupported_page", status: response.status };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 407) {
        return { code: "blocked", status: response.status };
      }
      return { code: "fetch_failed", status: response.status };
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

    return {
      html,
      finalUrl: response.url || url,
      contentType,
    };
  } catch (error) {
    logJobUrlImportDiagnostic("fetch_failed", {
      urlHost: safeHostFromUrl(url),
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

  if (blocked) {
    logJobUrlImportDiagnostic("blocked_detected", {
      urlHost: hostname,
      code: blocked,
      extractedLength: extracted.description.length,
    });
    return { ok: false, code: blocked };
  }

  if (extracted.description.length < MIN_JOB_DESCRIPTION_CHARS) {
    logJobUrlImportDiagnostic("extract_empty", {
      urlHost: hostname,
      extractedLength: extracted.description.length,
    });
    return { ok: false, code: "empty_extraction" };
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
