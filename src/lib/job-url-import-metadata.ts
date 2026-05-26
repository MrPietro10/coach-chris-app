import * as cheerio from "cheerio";
import { parseSuggestedJobTitle } from "@/lib/job-import-cleanup";

export type ExtractedJobMetadata = {
  title: string | null;
  company: string | null;
  location: string | null;
  sources: {
    title?: string;
    company?: string;
    location?: string;
  };
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function parseJsonLdJobPosting(raw: string): Partial<ExtractedJobMetadata> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      const type = record["@type"];
      const types = Array.isArray(type) ? type : type ? [type] : [];
      const isJobPosting =
        types.some((t) => typeof t === "string" && /JobPosting/i.test(t)) ||
        (typeof type === "string" && /JobPosting/i.test(type));

      if (!isJobPosting && !record.title && !record.description) {
        continue;
      }

      const org = record.hiringOrganization;
      let company: string | null = null;
      if (typeof org === "string") {
        company = org;
      } else if (org && typeof org === "object") {
        const orgName = (org as Record<string, unknown>).name;
        if (typeof orgName === "string") company = orgName;
      }

      let location: string | null = null;
      const jobLocation = record.jobLocation;
      if (typeof jobLocation === "string") {
        location = jobLocation;
      } else if (jobLocation && typeof jobLocation === "object") {
        const address = (jobLocation as Record<string, unknown>).address;
        if (address && typeof address === "object") {
          const addr = address as Record<string, unknown>;
          const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
            .filter((part) => typeof part === "string")
            .map((part) => (part as string).trim());
          if (parts.length > 0) location = parts.join(", ");
        }
        const locName = (jobLocation as Record<string, unknown>).name;
        if (!location && typeof locName === "string") location = locName;
      }

      const title = typeof record.title === "string" ? record.title : null;

      return {
        title,
        company,
        location,
        sources: {
          title: title ? "json-ld" : undefined,
          company: company ? "json-ld" : undefined,
          location: location ? "json-ld" : undefined,
        },
      };
    }
  } catch {
    return {};
  }
  return {};
}

function extractFromDom($: cheerio.CheerioAPI): Partial<ExtractedJobMetadata> {
  const title = firstNonEmpty(
    $("[data-automation-id='jobPostingHeader']").first().text(),
    $(".app-title").first().text(),
    $(".posting-headline h2").first().text(),
    $("h1.posting-title").first().text(),
    $("h1").first().text(),
    $('meta[property="og:title"]').attr("content"),
  );

  const company = firstNonEmpty(
    $("[data-automation-id='jobPostingCompany']").first().text(),
    $("[data-automation-id='company']").first().text(),
    $(".company-name").first().text(),
    $(".posting-company").first().text(),
    $(".main-header-company-name").first().text(),
    $('meta[property="og:site_name"]').attr("content"),
  );

  const location = firstNonEmpty(
    $("[data-automation-id='jobPostingLocation']").first().text(),
    $(".location").first().text(),
    $(".posting-categories .sort-by-location").first().text(),
    $(".posting-location").first().text(),
    $("[class*='location']").first().text(),
  );

  return {
    title: title?.replace(/\s+/g, " ").trim() ?? null,
    company: company?.replace(/\s+/g, " ").trim() ?? null,
    location: location?.replace(/\s+/g, " ").trim() ?? null,
    sources: {
      title: title ? "dom" : undefined,
      company: company ? "dom" : undefined,
      location: location ? "dom" : undefined,
    },
  };
}

export function extractJobMetadataFromHtml(
  html: string,
  pageUrl: string,
  suggestedTitle: string | null,
): ExtractedJobMetadata {
  const $ = cheerio.load(html);
  let jsonLd: Partial<ExtractedJobMetadata> = {};

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).html();
    if (!raw) return;
    const parsed = parseJsonLdJobPosting(raw);
    jsonLd = {
      title: firstNonEmpty(jsonLd.title, parsed.title),
      company: firstNonEmpty(jsonLd.company, parsed.company),
      location: firstNonEmpty(jsonLd.location, parsed.location),
      sources: { ...jsonLd.sources, ...parsed.sources },
    };
  });

  const dom = extractFromDom($);
  const fromTitle = parseSuggestedJobTitle(suggestedTitle);

  const title = firstNonEmpty(
    dom.title,
    jsonLd.title,
    fromTitle.title,
    suggestedTitle,
  );

  const company = firstNonEmpty(dom.company, jsonLd.company, fromTitle.company);

  const location = firstNonEmpty(dom.location, jsonLd.location);

  return {
    title,
    company,
    location,
    sources: {
      title: dom.sources?.title ?? jsonLd.sources?.title ?? (fromTitle.title ? "title-parse" : undefined),
      company: dom.sources?.company ?? jsonLd.sources?.company ?? (fromTitle.company ? "title-parse" : undefined),
      location: dom.sources?.location ?? jsonLd.sources?.location,
    },
  };
}
