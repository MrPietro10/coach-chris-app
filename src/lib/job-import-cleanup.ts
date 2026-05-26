import {
  countMeaningfulSections,
  formatSectionsForAnalysis,
  splitTextIntoSections,
  type JobDescriptionSection,
} from "@/lib/job-import-sections";

export type ImportExtractionQuality = "good" | "fair" | "weak";

export type CleanupStats = {
  rawLength: number;
  cleanedLength: number;
  boilerplateLinesRemoved: number;
  inlineBlocksRemoved: number;
};

const NOISE_LINE_PATTERNS: RegExp[] = [
  /^skip to (main )?content/i,
  /^skip to main/i,
  /^cookie/i,
  /^cookies?\b/i,
  /^we use cookies/i,
  /^this (site|website) uses cookies/i,
  /^your privacy/i,
  /^privacy (policy|notice|settings|choices)/i,
  /^terms (of use|and conditions|of service)/i,
  /^manage (cookie|consent|preferences)/i,
  /^accept (all )?cookies?/i,
  /^reject (all )?cookies?/i,
  /^consent preferences/i,
  /^gdpr/i,
  /^sign in$/i,
  /^log in$/i,
  /^create an account/i,
  /^apply now$/i,
  /^apply for this job/i,
  /^share (this )?job/i,
  /^save job$/i,
  /^report job$/i,
  /^powered by/i,
  /^©\s*\d{4}/i,
  /^copyright/i,
  /^all rights reserved/i,
  /^equal opportunity/i,
  /^accommodation(s)? request/i,
  /^eeo\b/i,
  /^follow us/i,
  /^connect with us/i,
  /^subscribe/i,
  /^newsletter/i,
  /^back to (jobs|careers|search)/i,
  /^view all (jobs|openings)/i,
  /^similar jobs/i,
  /^related jobs/i,
  /^job alerts/i,
];

const BOILERPLATE_INLINE_PATTERNS: RegExp[] = [
  /we use cookies[\s\S]{0,400}?(?=\n\n|\n[A-Z]|$)/gi,
  /this (website|site) uses cookies[\s\S]{0,400}?(?=\n\n|\n[A-Z]|$)/gi,
  /by (clicking|continuing|using this site)[\s\S]{0,250}?cookies[\s\S]{0,200}?(?=\n\n|$)/gi,
  /accept all cookies[\s\S]{0,120}?(?=\n\n|$)/gi,
  /manage cookie preferences[\s\S]{0,200}?(?=\n\n|$)/gi,
];

const COOKIE_REMAINS_PATTERN =
  /\b(cookie|cookies|privacy policy|consent banner|gdpr)\b/i;

function fixCollapsedWords(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/,([A-Za-z])/g, ", $1")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length < 4 && !/[a-z]{2,}/i.test(trimmed)) {
    return true;
  }
  if (NOISE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  if (/^(home|about|careers|jobs|contact|menu|search)$/i.test(trimmed)) {
    return true;
  }
  if (/^\d+\s*(comments?|views?|applicants?)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function cleanupImportedJobDescription(raw: string): string {
  return cleanupImportedJobDescriptionWithStats(raw).text;
}

export function cleanupImportedJobDescriptionWithStats(raw: string): CleanupStats & { text: string } {
  const rawLength = raw.length;
  let text = raw.replace(/\r\n/g, "\n");
  let inlineBlocksRemoved = 0;

  for (const pattern of BOILERPLATE_INLINE_PATTERNS) {
    const before = text;
    text = text.replace(pattern, "\n");
    if (text !== before) inlineBlocksRemoved += 1;
  }

  text = fixCollapsedWords(text);

  const lines = text.split("\n").map((line) => line.replace(/[ \t]{2,}/g, " ").trim());
  const filtered: string[] = [];
  let boilerplateLinesRemoved = 0;

  for (const line of lines) {
    if (!line) {
      if (filtered.length > 0 && filtered[filtered.length - 1] !== "") {
        filtered.push("");
      }
      continue;
    }
    if (isNoiseLine(line)) {
      boilerplateLinesRemoved += 1;
      continue;
    }
    filtered.push(line);
  }

  const cleaned = filtered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: cleaned,
    rawLength,
    cleanedLength: cleaned.length,
    boilerplateLinesRemoved,
    inlineBlocksRemoved,
  };
}

export function parseSuggestedJobTitle(raw: string | null): { title: string; company: string } {
  if (!raw?.trim()) {
    return { title: "", company: "" };
  }
  const trimmed = raw.trim();
  const atMatch = trimmed.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() };
  }
  const dashParts = trimmed.split(/\s[-–|•]\s+/);
  if (dashParts.length >= 2) {
    return {
      title: dashParts[0].trim(),
      company: dashParts.slice(1).join(" - ").trim(),
    };
  }
  return { title: trimmed, company: "" };
}

export type ProcessedImportDescription = {
  description: string;
  sections: JobDescriptionSection[];
  cleanup: CleanupStats;
};

export function buildProcessedJobDescription(rawText: string): ProcessedImportDescription {
  const cleanup = cleanupImportedJobDescriptionWithStats(rawText);
  const sections = splitTextIntoSections(cleanup.text);
  const formatted =
    sections.length > 0 ? formatSectionsForAnalysis(sections) : cleanup.text;

  return {
    description: formatted.trim() || cleanup.text,
    sections,
    cleanup,
  };
}

export type ExtractionQualityAssessment = {
  quality: ImportExtractionQuality;
  reviewHint: string | null;
  reasons: string[];
};

export function assessImportExtractionQuality(input: {
  description: string;
  cleanup: CleanupStats;
  sections: JobDescriptionSection[];
  metadata: {
    title: string | null;
    company: string | null;
    location: string | null;
  };
}): ExtractionQualityAssessment {
  const reasons: string[] = [];
  const meaningfulSections = countMeaningfulSections(input.sections);
  const hasCookieNoise = COOKIE_REMAINS_PATTERN.test(input.description.slice(0, 2000));
  const missingCompany = !input.metadata.company?.trim();
  const missingLocation = !input.metadata.location?.trim();
  const shortText = input.description.length < 450;
  const heavyBoilerplate =
    input.cleanup.boilerplateLinesRemoved >= 8 || input.cleanup.inlineBlocksRemoved >= 2;

  if (hasCookieNoise) reasons.push("cookie_or_privacy_text_remaining");
  if (shortText) reasons.push("short_description");
  if (missingCompany) reasons.push("missing_company");
  if (missingLocation) reasons.push("missing_location");
  if (meaningfulSections === 0) reasons.push("no_sections_detected");
  if (heavyBoilerplate) reasons.push("heavy_boilerplate_removed");

  let quality: ImportExtractionQuality = "good";

  if (
    shortText ||
    hasCookieNoise ||
    (missingCompany && missingLocation && meaningfulSections === 0)
  ) {
    quality = "weak";
  } else if (
    missingCompany ||
    missingLocation ||
    meaningfulSections < 2 ||
    heavyBoilerplate
  ) {
    quality = "fair";
  }

  let reviewHint: string | null = null;
  if (quality === "weak") {
    reviewHint =
      "This import may be incomplete or include website text. Please review the title, company, location, and description carefully before continuing.";
  } else if (quality === "fair") {
    reviewHint =
      "Some details may be missing or need cleanup. Double-check company, location, and section wording before you analyze.";
  }

  return { quality, reviewHint, reasons };
}
