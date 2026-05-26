import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { cleanupImportedJobDescription } from "@/lib/job-import-cleanup";
import {
  formatSectionsForAnalysis,
  matchSectionHeader,
  type JobDescriptionSection,
} from "@/lib/job-import-sections";

export type JobHtmlExtractionResult = {
  description: string;
  suggestedTitle: string | null;
  extractor: "readability" | "cheerio" | "combined" | "structured";
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
  ".section-wrapper",
  ".content",
  "article",
  "main",
  "[role='main']",
];

const NOISE_DOM_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "nav",
  "footer",
  "header",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[class*='privacy-banner']",
  "[class*='gdpr']",
  "#onetrust-consent-sdk",
  ".ot-sdk-container",
  "[data-testid*='cookie']",
  "[aria-label*='cookie' i]",
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

function stripNoiseFromDom($: cheerio.CheerioAPI): void {
  for (const selector of NOISE_DOM_SELECTORS) {
    $(selector).remove();
  }
}

function extractStructuredSectionsFromHtml(html: string): string {
  const $ = cheerio.load(html);
  stripNoiseFromDom($);

  const root =
    $("[data-automation-id='jobPostingDescription']").first().length > 0
      ? $("[data-automation-id='jobPostingDescription']").first()
      : $(".job-description, .posting-requirements, article, main, [role='main']").first();

  const scope = root.length > 0 ? root : $("body");
  const sections: JobDescriptionSection[] = [];
  let current: JobDescriptionSection | null = null;
  const preamble: string[] = [];

  function flushSection(): void {
    if (!current) return;
    const trimmedContent = current.content.trim();
    if (trimmedContent.length > 0) {
      sections.push({
        key: current.key,
        label: current.label,
        content: trimmedContent,
      });
    }
    current = null;
  }

  function pushLine(target: string[], line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      if (target.length > 0 && target[target.length - 1] !== "") {
        target.push("");
      }
      return;
    }
    target.push(trimmed);
  }

  scope.find("h1, h2, h3, h4, h5, h6, p, li").each((_, element) => {
    const tag = element.tagName?.toLowerCase() ?? "";
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (!text) return;

    if (/^h[1-6]$/.test(tag)) {
      const matched = matchSectionHeader(text);
      if (matched) {
        flushSection();
        current = {
          key: matched.key,
          label: matched.label,
          content: "",
        };
        return;
      }
    }

    if (current) {
      current.content += (current.content ? "\n" : "") + (tag === "li" ? `• ${text}` : text);
    } else {
      pushLine(preamble, tag === "li" ? `• ${text}` : text);
    }
  });

  flushSection();

  const overview = preamble.join("\n").trim();
  if (overview.length > 40) {
    sections.unshift({ key: "overview", label: "Overview", content: overview });
  }

  const formatted = formatSectionsForAnalysis(sections);
  return formatted.length >= MIN_DESCRIPTION_CHARS ? formatted : "";
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
  stripNoiseFromDom($);

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

  const h1 = $("[data-automation-id='jobPostingHeader'] h1, h1.posting-title, h1")
    .first()
    .text()
    .trim();
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
  void pageUrl;

  const structuredText = extractStructuredSectionsFromHtml(html);
  const readabilityText = extractWithReadability(html, pageUrl);
  const cheerioText = extractWithCheerioHeuristics(html);

  const candidates: Array<{ text: string; extractor: JobHtmlExtractionResult["extractor"] }> = [];

  if (structuredText.length >= MIN_DESCRIPTION_CHARS) {
    candidates.push({ text: structuredText, extractor: "structured" });
  }
  if (readabilityText.length >= MIN_DESCRIPTION_CHARS) {
    candidates.push({ text: readabilityText, extractor: "readability" });
  }
  if (cheerioText.length >= MIN_DESCRIPTION_CHARS) {
    candidates.push({ text: cheerioText, extractor: "cheerio" });
  }

  if (candidates.length === 0) {
    return {
      description: "",
      suggestedTitle: extractSuggestedTitle(html),
      extractor: "readability",
    };
  }

  candidates.sort((a, b) => b.text.length - a.text.length);
  const best = candidates[0];

  if (candidates.length >= 2 && best.extractor === "structured") {
    return {
      description: best.text,
      suggestedTitle: extractSuggestedTitle(html),
      extractor: "structured",
    };
  }

  if (
    readabilityText.length >= MIN_DESCRIPTION_CHARS &&
    cheerioText.length >= MIN_DESCRIPTION_CHARS &&
    readabilityText !== cheerioText &&
    best.extractor !== "structured"
  ) {
    const combined =
      readabilityText.length >= cheerioText.length
        ? `${readabilityText}\n\n${cheerioText}`
        : `${cheerioText}\n\n${readabilityText}`;
    return {
      description: normalizeExtractedText(combined),
      suggestedTitle: extractSuggestedTitle(html),
      extractor: "combined",
    };
  }

  return {
    description: best.text,
    suggestedTitle: extractSuggestedTitle(html),
    extractor: best.extractor,
  };
}
