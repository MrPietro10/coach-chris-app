import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { cleanupImportedJobDescription } from "@/lib/job-import-cleanup";

export type JobHtmlExtractionResult = {
  description: string;
  suggestedTitle: string | null;
  extractor: "readability" | "cheerio" | "combined";
};

const JOB_CONTENT_SELECTORS = [
  "[data-automation-id='jobPostingDescription']",
  ".jobs-description__content",
  ".jobs-description",
  ".job-description",
  ".job-description-content",
  "#job-details",
  "#jobDescriptionText",
  ".posting-requirements",
  ".description__text",
  "article",
  "main",
  "[role='main']",
];

const MIN_DESCRIPTION_CHARS = 200;

function normalizeExtractedText(raw: string): string {
  return cleanupImportedJobDescription(
    raw
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function extractWithReadability(html: string, pageUrl: string): string {
  const { document } = parseHTML(html);
  void pageUrl;

  const article = new Readability(document as unknown as Document, {
    charThreshold: 100,
  }).parse();

  return normalizeExtractedText(article?.textContent ?? "");
}

function extractWithCheerioHeuristics(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, footer, header").remove();

  const candidates: string[] = [];

  for (const selector of JOB_CONTENT_SELECTORS) {
    $(selector).each((_, element) => {
      const text = normalizeExtractedText($(element).text());
      if (text.length >= MIN_DESCRIPTION_CHARS) {
        candidates.push(text);
      }
    });
  }

  const bodyText = normalizeExtractedText($("body").text());
  if (bodyText.length >= MIN_DESCRIPTION_CHARS) {
    candidates.push(bodyText);
  }

  if (candidates.length === 0) {
    return "";
  }

  return candidates.sort((a, b) => b.length - a.length)[0] ?? "";
}

function extractSuggestedTitle(html: string): string | null {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle && ogTitle.length > 2) {
    return ogTitle;
  }

  const h1 = $("h1").first().text().trim();
  if (h1.length > 2) {
    return h1;
  }

  const documentTitle = $("title").first().text().trim();
  if (documentTitle.length > 2) {
    return documentTitle.replace(/\s*[-|•]\s*.+$/, "").trim();
  }

  return null;
}

/**
 * Default HTML extraction for public job pages.
 * Firecrawl can replace this step later while keeping the same return shape.
 */
export function extractJobDescriptionFromHtml(
  html: string,
  pageUrl: string,
): JobHtmlExtractionResult {
  const readabilityText = extractWithReadability(html, pageUrl);
  const cheerioText = extractWithCheerioHeuristics(html);

  let description = "";
  let extractor: JobHtmlExtractionResult["extractor"] = "readability";

  if (readabilityText.length >= cheerioText.length) {
    description = readabilityText;
    extractor = "readability";
  } else {
    description = cheerioText;
    extractor = "cheerio";
  }

  if (
    readabilityText.length >= MIN_DESCRIPTION_CHARS &&
    cheerioText.length >= MIN_DESCRIPTION_CHARS &&
    readabilityText !== cheerioText
  ) {
    const combined =
      readabilityText.length >= cheerioText.length
        ? `${readabilityText}\n\n${cheerioText}`
        : `${cheerioText}\n\n${readabilityText}`;
    description = normalizeExtractedText(combined);
    extractor = "combined";
  }

  return {
    description,
    suggestedTitle: extractSuggestedTitle(html),
    extractor,
  };
}
