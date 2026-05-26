import {
  buildJobUrlImportDiagnostics,
  logJobUrlImportFailureDiagnostics,
  type JobUrlImportDiagnostics,
} from "@/lib/job-url-import-diagnostics";
import {
  extractFromFetchedHtml,
  fetchPublicJobPageHtml,
  logJobUrlImportDiagnostic,
  validatePublicJobUrl,
  type ValidatedJobUrl,
} from "@/lib/job-url-import";
import {
  classifyJobUrlPage,
  looksLikeSearchResultsPage,
} from "@/lib/job-url-import-url-classifier";
import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";
import { normalizeImportFailureCode } from "@/lib/job-url-import-messages";

/**
 * V1: fetch-html only (cheerio + readability).
 * Future: firecrawl | apify | approved-connector via JOB_URL_IMPORT_PROVIDER.
 */
export type JobUrlImportProvider =
  | "fetch-html"
  | "firecrawl"
  | "apify"
  | "approved-connector";

export type JobUrlImportSuccess = {
  ok: true;
  description: string;
  suggestedTitle: string | null;
  company: string | null;
  location: string | null;
  extractionQuality: "good" | "fair" | "weak";
  reviewHint: string | null;
  sourceUrl: string;
  provider: JobUrlImportProvider;
  importDiagnostics?: JobUrlImportDiagnostics;
};

export type JobUrlImportFailure = {
  ok: false;
  code: JobUrlImportErrorCode;
  diagnostics?: JobUrlImportDiagnostics;
};

export type JobUrlImportResult = JobUrlImportSuccess | JobUrlImportFailure;

function resolveImportProvider(): JobUrlImportProvider {
  const configured = process.env.JOB_URL_IMPORT_PROVIDER?.trim().toLowerCase();
  if (
    configured === "firecrawl" ||
    configured === "apify" ||
    configured === "approved-connector"
  ) {
    return configured;
  }
  return "fetch-html";
}

async function importJobDescriptionViaFirecrawl(
  validated: ValidatedJobUrl,
): Promise<JobUrlImportResult> {
  void validated;
  logJobUrlImportDiagnostic("provider_skipped", { provider: "firecrawl", reason: "not_configured" });
  return { ok: false, code: "provider_not_configured" };
}

async function importJobDescriptionViaApify(
  validated: ValidatedJobUrl,
): Promise<JobUrlImportResult> {
  void validated;
  logJobUrlImportDiagnostic("provider_skipped", { provider: "apify", reason: "not_configured" });
  return { ok: false, code: "provider_not_configured" };
}

async function importJobDescriptionViaApprovedConnector(
  validated: ValidatedJobUrl,
): Promise<JobUrlImportResult> {
  void validated;
  logJobUrlImportDiagnostic("provider_skipped", {
    provider: "approved-connector",
    reason: "not_configured",
  });
  return { ok: false, code: "provider_not_configured" };
}

function failure(
  code: JobUrlImportErrorCode,
  diagnostics: JobUrlImportDiagnostics,
): JobUrlImportFailure {
  const normalized = normalizeImportFailureCode(code, { hostname: diagnostics.urlHost });
  const finalDiagnostics = { ...diagnostics, errorCode: normalized };
  logJobUrlImportFailureDiagnostics(finalDiagnostics);
  return { ok: false, code: normalized, diagnostics: finalDiagnostics };
}

async function importJobDescriptionViaFetchHtml(
  validated: ValidatedJobUrl,
): Promise<JobUrlImportResult> {
  const pageKind = classifyJobUrlPage(validated.hostname, validated.href);
  const searchLike = looksLikeSearchResultsPage(validated.hostname, validated.href);

  logJobUrlImportDiagnostic("url_classified", {
    urlHost: validated.hostname,
    urlPageKind: pageKind,
    looksLikeSearchResults: searchLike,
  });

  logJobUrlImportDiagnostic("fetch_started", { urlHost: validated.hostname });

  const fetched = await fetchPublicJobPageHtml(validated.href);
  if ("code" in fetched) {
    return failure(
      fetched.code,
      buildJobUrlImportDiagnostics({
        urlHost: validated.hostname,
        httpStatus: fetched.status,
        contentType: fetched.contentType ?? null,
        failureReason: "fetch_failed",
        urlPageKind: pageKind,
        looksLikeSearchResults: searchLike,
        errorCode: fetched.code,
      }),
    );
  }

  const extracted = extractFromFetchedHtml(
    fetched.html,
    fetched.finalUrl,
    validated.hostname,
    fetched.httpStatus,
  );

  if (!extracted.ok) {
    return failure(
      extracted.code,
      buildJobUrlImportDiagnostics({
        urlHost: validated.hostname,
        httpStatus: fetched.httpStatus,
        contentType: fetched.contentType,
        fetchedHtmlLength: fetched.html.length,
        extractedTextLength: 0,
        failureReason: extracted.code,
        urlPageKind: classifyJobUrlPage(validated.hostname, fetched.finalUrl),
        looksLikeSearchResults: looksLikeSearchResultsPage(
          validated.hostname,
          fetched.finalUrl,
        ),
        errorCode: extracted.code,
      }),
    );
  }

  const includeDiagnostics = process.env.NODE_ENV !== "production";

  return {
    ok: true,
    description: extracted.description,
    suggestedTitle: extracted.suggestedTitle,
    company: extracted.company,
    location: extracted.location,
    extractionQuality: extracted.extractionQuality,
    reviewHint: extracted.reviewHint,
    sourceUrl: fetched.finalUrl,
    provider: "fetch-html",
    ...(includeDiagnostics
      ? {
          importDiagnostics: {
            urlHost: validated.hostname,
            httpStatus: fetched.httpStatus,
            contentType: fetched.contentType,
            fetchedHtmlLength: fetched.html.length,
            extractedTextLength: extracted.importDiagnostics.extractedTextLength,
            boilerplateLinesRemoved: extracted.importDiagnostics.boilerplateLinesRemoved,
            inlineBlocksRemoved: extracted.importDiagnostics.inlineBlocksRemoved,
            sectionsDetected: extracted.importDiagnostics.sectionsDetected,
            metadataFound: extracted.importDiagnostics.metadataFound,
            extractionQuality: extracted.extractionQuality,
            qualityReasons: extracted.importDiagnostics.qualityReasons,
          },
        }
      : {}),
  };
}

export async function importJobDescriptionFromUrl(
  rawUrl: string,
  options?: { provider?: JobUrlImportProvider },
): Promise<JobUrlImportResult> {
  const validation = validatePublicJobUrl(rawUrl);
  if (typeof validation === "string") {
    logJobUrlImportDiagnostic("validation_failed", { code: validation });
    const normalized = normalizeImportFailureCode(validation);
    return {
      ok: false,
      code: normalized,
      diagnostics: buildJobUrlImportDiagnostics({
        urlHost: safeHostFromRawUrl(rawUrl) ?? "unknown",
        failureReason: "validation_failed",
        errorCode: normalized,
      }),
    };
  }

  const provider = options?.provider ?? resolveImportProvider();

  switch (provider) {
    case "firecrawl":
      return importJobDescriptionViaFirecrawl(validation);
    case "apify":
      return importJobDescriptionViaApify(validation);
    case "approved-connector":
      return importJobDescriptionViaApprovedConnector(validation);
    case "fetch-html":
    default:
      return importJobDescriptionViaFetchHtml(validation);
  }
}

function safeHostFromRawUrl(rawUrl: string): string | null {
  try {
    return new URL(rawUrl.trim()).hostname;
  } catch {
    return null;
  }
}
