import {
  extractFromFetchedHtml,
  fetchPublicJobPageHtml,
  logJobUrlImportDiagnostic,
  validatePublicJobUrl,
  type ValidatedJobUrl,
} from "@/lib/job-url-import";
import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";

export type JobUrlImportProvider = "fetch-html" | "firecrawl";

export type JobUrlImportSuccess = {
  ok: true;
  description: string;
  suggestedTitle: string | null;
  sourceUrl: string;
  provider: JobUrlImportProvider;
};

export type JobUrlImportFailure = {
  ok: false;
  code: JobUrlImportErrorCode;
};

export type JobUrlImportResult = JobUrlImportSuccess | JobUrlImportFailure;

function resolveImportProvider(): JobUrlImportProvider {
  const configured = process.env.JOB_URL_IMPORT_PROVIDER?.trim().toLowerCase();
  if (configured === "firecrawl") {
    return "firecrawl";
  }
  return "fetch-html";
}

/**
 * Firecrawl hook — not enabled in V1.
 * When ready, implement here and switch JOB_URL_IMPORT_PROVIDER=firecrawl.
 */
async function importJobDescriptionViaFirecrawl(
  validated: ValidatedJobUrl,
): Promise<JobUrlImportResult> {
  void validated;
  logJobUrlImportDiagnostic("provider_skipped", { provider: "firecrawl", reason: "not_configured" });
  return { ok: false, code: "provider_not_configured" };
}

async function importJobDescriptionViaFetchHtml(
  validated: ValidatedJobUrl,
): Promise<JobUrlImportResult> {
  logJobUrlImportDiagnostic("fetch_started", { urlHost: validated.hostname });

  const fetched = await fetchPublicJobPageHtml(validated.href);
  if ("code" in fetched) {
    return { ok: false, code: fetched.code };
  }

  const extracted = extractFromFetchedHtml(
    fetched.html,
    fetched.finalUrl,
    validated.hostname,
    200,
  );

  if (!extracted.ok) {
    return { ok: false, code: extracted.code };
  }

  return {
    ok: true,
    description: extracted.description,
    suggestedTitle: extracted.suggestedTitle,
    sourceUrl: fetched.finalUrl,
    provider: "fetch-html",
  };
}

export async function importJobDescriptionFromUrl(
  rawUrl: string,
  options?: { provider?: JobUrlImportProvider },
): Promise<JobUrlImportResult> {
  const validation = validatePublicJobUrl(rawUrl);
  if (typeof validation === "string") {
    logJobUrlImportDiagnostic("validation_failed", { code: validation });
    return { ok: false, code: validation };
  }

  const provider = options?.provider ?? resolveImportProvider();

  if (provider === "firecrawl") {
    return importJobDescriptionViaFirecrawl(validation);
  }

  return importJobDescriptionViaFetchHtml(validation);
}
