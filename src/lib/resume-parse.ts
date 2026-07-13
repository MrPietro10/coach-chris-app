import {
  LEGACY_DOC_EXTENSION,
  LEGACY_DOC_MESSAGE,
  MAX_RESUME_FILE_SIZE_BYTES,
  PARSEABLE_RESUME_EXTENSIONS,
  PARSEABLE_RESUME_LABEL,
} from "@/lib/resume-upload";
import {
  getUserFacingParseError,
  PARSE_PARTIAL_WARNING,
  type ResumeParseErrorCode,
  type ResumeParseFailureStage,
} from "@/lib/resume-parse-messages";

export type ParsedResumeFields = {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
  rawText: string;
  candidateName?: string;
  contactLine?: string;
  extraSections?: ParsedResumeSection[];
};

export type ParsedResumeSection = {
  heading: string;
  content: string;
};

export type PdfExtractionDiagnostic = {
  bufferBytes: number;
  pageCount: number;
  resultTextLength: number;
  aggregatedTextLength: number;
  perPageTextLengths: number[];
};

export type ParsedResumeResult =
  | { ok: true; fields: ParsedResumeFields; fileType: "pdf" | "docx"; warning?: string }
  | {
      ok: false;
      error: string;
      title: string;
      hint?: string;
      code: ResumeParseErrorCode;
      stage: ResumeParseFailureStage;
      diagnostic?: string;
    };

function getExtension(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function failure(
  code: ResumeParseErrorCode,
  stage: ResumeParseFailureStage,
  options?: { fileType?: "pdf" | "docx"; diagnostic?: string },
): ParsedResumeResult {
  const copy = getUserFacingParseError(code, { fileType: options?.fileType });
  return {
    ok: false,
    code,
    stage,
    error: copy.message,
    title: copy.title,
    hint: copy.hint,
    diagnostic: options?.diagnostic,
  };
}

export function validateParseableResumeFile(
  filename: string,
  size: number,
): ParsedResumeResult | { ok: true; fileType: "pdf" | "docx" } {
  const ext = getExtension(filename);

  if (ext === LEGACY_DOC_EXTENSION) {
    return failure("unsupported", "validation", { diagnostic: "legacy_doc" });
  }

  if (!PARSEABLE_RESUME_EXTENSIONS.includes(ext as (typeof PARSEABLE_RESUME_EXTENSIONS)[number])) {
    return failure("unsupported", "validation", {
      diagnostic: `extension:${ext || "none"}`,
    });
  }

  if (size <= 0) {
    return failure("empty_file", "validation");
  }

  if (size > MAX_RESUME_FILE_SIZE_BYTES) {
    return failure("too_large", "validation");
  }

  return { ok: true, fileType: ext === ".pdf" ? "pdf" : "docx" };
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Count alphanumeric characters — more reliable than raw length for “empty” PDFs. */
export function countMeaningfulCharacters(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]/gu);
  return matches?.length ?? 0;
}

const MIN_MEANINGFUL_CHARACTERS = 24;

type ResumeSectionKey = "summary" | "skills" | "highlights" | "education";

const SKILLS_SECTION_PATTERNS = [
  /^(core\s+)?skills?\b/i,
  /^technical\s+skills?\b/i,
  /^key\s+skills?\b/i,
  /^skills?\s*&\s*tools\b/i,
  /^skills?\s+and\s+tools\b/i,
  /^tools?\b/i,
  /^tools?\s+and\s+technologies\b/i,
  /^technologies\b/i,
  /^technical\s+proficiencies\b/i,
  /^competencies\b/i,
  /^other\s+information\b/i,
];

const EXPERIENCE_SECTION_PATTERNS = [
  /^experience\b/i,
  /^work\s+experience\b/i,
  /^professional\s+experience\b/i,
  /^employment\b/i,
  /^career\s+history\b/i,
  /^relevant\s+experience\b/i,
  /^projects?\b/i,
];

const SUMMARY_SECTION_PATTERNS = [
  /^summary\b/i,
  /^professional\s+summary\b/i,
  /^profile\b/i,
  /^about\s+me\b/i,
  /^objective\b/i,
];

const EDUCATION_SECTION_PATTERNS = [
  /^education\b/i,
  /^academic\s+background\b/i,
  /^academics\b/i,
  /^qualifications\b/i,
  /^degrees?\b/i,
];

const EXTRA_SECTION_PATTERNS: Array<{ heading: string; patterns: RegExp[] }> = [
  { heading: "Languages", patterns: [/^languages?\b/i] },
  { heading: "Certifications", patterns: [/^certifications?\b/i, /^licenses?\b/i] },
  { heading: "Projects", patterns: [/^selected\s+projects?\b/i] },
  { heading: "Awards", patterns: [/^awards?\b/i, /^honors?\b/i] },
  { heading: "Volunteer Experience", patterns: [/^volunteer(\s+experience)?\b/i] },
  { heading: "Publications", patterns: [/^publications?\b/i] },
  { heading: "Links", patterns: [/^links?\b/i, /^portfolio\b/i, /^websites?\b/i] },
  { heading: "Other Information", patterns: [/^other\s+information\b/i, /^additional\s+information\b/i] },
];

const MAX_SECTION_HEADER_LENGTH = 80;

function isLikelySectionHeader(line: string): boolean {
  return line.length > 0 && line.length <= MAX_SECTION_HEADER_LENGTH;
}

function detectResumeSectionHeader(line: string): ResumeSectionKey | null {
  if (!isLikelySectionHeader(line)) return null;
  if (SUMMARY_SECTION_PATTERNS.some((pattern) => pattern.test(line))) return "summary";
  if (SKILLS_SECTION_PATTERNS.some((pattern) => pattern.test(line))) return "skills";
  if (EXPERIENCE_SECTION_PATTERNS.some((pattern) => pattern.test(line))) return "highlights";
  if (EDUCATION_SECTION_PATTERNS.some((pattern) => pattern.test(line))) return "education";
  return null;
}

function detectExtraSectionHeader(line: string): string | null {
  if (!isLikelySectionHeader(line)) return null;
  for (const section of EXTRA_SECTION_PATTERNS) {
    if (section.patterns.some((pattern) => pattern.test(line))) {
      return section.heading;
    }
  }
  return null;
}

function looksLikeCandidateName(line: string): boolean {
  if (line.length < 3 || line.length > 80) return false;
  if (/\d/.test(line) || /@/.test(line) || /https?:\/\//i.test(line)) return false;
  if (/[|]/.test(line)) return false;
  return /^[A-Za-z][A-Za-z'., -]+$/.test(line);
}

function extractHeaderDetails(lines: string[]): { candidateName?: string; contactLine?: string } {
  const headerLines: string[] = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (headerLines.length > 0) break;
      continue;
    }
    if (detectResumeSectionHeader(trimmed) || detectExtraSectionHeader(trimmed)) {
      break;
    }
    headerLines.push(trimmed);
    if (headerLines.length >= 4) break;
  }

  if (headerLines.length === 0) return {};
  const candidateName = looksLikeCandidateName(headerLines[0]) ? headerLines[0] : undefined;
  const remaining = candidateName ? headerLines.slice(1) : headerLines;
  const contactLine = remaining.length > 0 ? remaining.join(" · ") : undefined;
  return { candidateName, contactLine };
}

function mapResumeTextToFields(rawText: string): ParsedResumeFields {
  const normalized = normalizeExtractedText(rawText);
  if (!normalized) {
    return { summary: "", skills: "", highlights: "", education: "", rawText: "", extraSections: [] };
  }

  const lines = normalized.split("\n");
  const { candidateName, contactLine } = extractHeaderDetails(lines);
  const sections: Record<ResumeSectionKey, string[]> = {
    summary: [],
    skills: [],
    highlights: [],
    education: [],
  };
  const extraSections = new Map<string, string[]>();
  let current: ResumeSectionKey = "summary";
  let currentExtraHeading: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentExtraHeading) {
        extraSections.set(currentExtraHeading, [...(extraSections.get(currentExtraHeading) ?? []), ""]);
      } else {
        sections[current].push("");
      }
      continue;
    }

    const extraSectionHeader = detectExtraSectionHeader(trimmed);
    if (extraSectionHeader) {
      currentExtraHeading = extraSectionHeader;
      if (!extraSections.has(extraSectionHeader)) {
        extraSections.set(extraSectionHeader, []);
      }
      continue;
    }

    const sectionHeader = detectResumeSectionHeader(trimmed);
    if (sectionHeader) {
      current = sectionHeader;
      currentExtraHeading = null;
      continue;
    }

    if (currentExtraHeading) {
      extraSections.set(currentExtraHeading, [...(extraSections.get(currentExtraHeading) ?? []), trimmed]);
    } else {
      sections[current].push(trimmed);
    }
  }

  const joinSection = (items: string[]) =>
    items
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  let summary = joinSection(sections.summary);
  let skills = joinSection(sections.skills);
  let highlights = joinSection(sections.highlights);
  let education = joinSection(sections.education);

  if (!skills && !highlights) {
    summary = normalized;
  }

  if (!summary.trim()) {
    summary = normalized;
  }

  if (skills && !skills.includes(",") && skills.split("\n").length > 1) {
    skills = skills
      .split("\n")
      .map((item) => item.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .join(", ");
  }

  if (highlights) {
    highlights = highlights
      .split("\n")
      .map((item) => item.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .join("\n");
  }

  if (education) {
    education = education
      .split("\n")
      .map((item) => item.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .join("\n");
  }

  const extraSectionOutput = Array.from(extraSections.entries())
    .map(([heading, items]) => ({
      heading,
      content: joinSection(items),
    }))
    .filter((section) => section.content.length > 0);

  return {
    summary,
    skills,
    highlights,
    education,
    rawText: normalized,
    candidateName,
    contactLine,
    extraSections: extraSectionOutput,
  };
}

function toParseableBinary(buffer: Buffer): Uint8Array {
  if (buffer instanceof Buffer) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return new Uint8Array(buffer);
}

function aggregatePdfTextResult(result: {
  text?: string;
  pages?: { text?: string; num?: number }[];
}): { text: string; pageCount: number; perPageTextLengths: number[] } {
  const pages = result.pages ?? [];
  const perPageTextLengths = pages.map((page) => (typeof page.text === "string" ? page.text.length : 0));
  const pageCount = pages.length;
  const joinedPages = pages
    .map((page) => (typeof page.text === "string" ? page.text : ""))
    .filter((text) => text.trim().length > 0)
    .join("\n\n");

  const primary = typeof result.text === "string" ? result.text : "";
  const text =
    countMeaningfulCharacters(primary) >= countMeaningfulCharacters(joinedPages)
      ? primary
      : joinedPages || primary;

  return { text, pageCount, perPageTextLengths };
}

export async function extractPdfText(
  buffer: Buffer,
): Promise<{ text: string; diagnostic: PdfExtractionDiagnostic }> {
  const { PDFParse } = await import("pdf-parse");
  const binary = toParseableBinary(buffer);
  const parser = new PDFParse({ data: binary });
  try {
    const result = await parser.getText();
    const aggregated = aggregatePdfTextResult(result);
    return {
      text: aggregated.text,
      diagnostic: {
        bufferBytes: buffer.length,
        pageCount: aggregated.pageCount,
        resultTextLength: typeof result.text === "string" ? result.text.length : 0,
        aggregatedTextLength: aggregated.text.length,
        perPageTextLengths: aggregated.perPageTextLengths,
      },
    };
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return typeof result.value === "string" ? result.value : "";
}

export function logParseResumeDiagnostic(
  event: string,
  details: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[parse-resume] ${event}`, details);
}

export function logParseResumeError(
  event: string,
  error: unknown,
  details: Record<string, unknown>,
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error(`[parse-resume] ${event}`, { ...details, error: err });
}

export async function parseResumeBuffer(
  buffer: Buffer,
  filename: string,
): Promise<ParsedResumeResult> {
  const validation = validateParseableResumeFile(filename, buffer.length);
  if (!validation.ok) {
    if (validation.code === "unsupported" && getExtension(filename) === LEGACY_DOC_EXTENSION) {
      return {
        ...validation,
        error: LEGACY_DOC_MESSAGE,
        title: "Unsupported file",
        hint: "Convert to PDF or DOCX and try again.",
      };
    }
    if (validation.code === "unsupported") {
      return {
        ...validation,
        error: `Unsupported file type. Use ${PARSEABLE_RESUME_LABEL}.`,
      };
    }
    return validation;
  }

  const fileType = validation.fileType;

  try {
    let rawText = "";
    let extractionDiagnostic: Record<string, unknown> = { bufferBytes: buffer.length };

    if (fileType === "pdf") {
      const pdfResult = await extractPdfText(buffer);
      rawText = pdfResult.text;
      extractionDiagnostic = { ...extractionDiagnostic, ...pdfResult.diagnostic };
    } else {
      rawText = await extractDocxText(buffer);
      extractionDiagnostic = {
        ...extractionDiagnostic,
        aggregatedTextLength: rawText.length,
      };
    }

    logParseResumeDiagnostic("extraction_complete", {
      fileName: filename,
      fileType,
      ...extractionDiagnostic,
      meaningfulChars: countMeaningfulCharacters(rawText),
    });

    const normalized = normalizeExtractedText(rawText);
    const meaningfulChars = countMeaningfulCharacters(normalized);

    if (!normalized || meaningfulChars < MIN_MEANINGFUL_CHARACTERS) {
      logParseResumeDiagnostic("empty_extraction", {
        fileName: filename,
        fileType,
        ...extractionDiagnostic,
        meaningfulChars,
        normalizedLength: normalized.length,
      });
      return failure("empty_extraction", "extraction", {
        fileType,
        diagnostic: `meaningful_chars_${meaningfulChars}_after_${fileType}_extract`,
      });
    }

    const fields = mapResumeTextToFields(normalized);

    const hasMappedContent =
      fields.summary.trim().length > 0 ||
      fields.skills.trim().length > 0 ||
      fields.highlights.trim().length > 0 ||
      fields.education.trim().length > 0;

    if (!hasMappedContent) {
      fields.summary = normalized;
    }

    const usedSingleBlockFallback =
      !fields.skills.trim() && !fields.highlights.trim() && fields.summary.trim().length > 0;

    const warning =
      usedSingleBlockFallback || meaningfulChars < 80 ? PARSE_PARTIAL_WARNING : undefined;

    return {
      ok: true,
      fileType,
      fields,
      warning,
    };
  } catch (error) {
    logParseResumeError("parser_exception", error, {
      fileName: filename,
      fileType,
      bufferBytes: buffer.length,
    });
    return failure("parser_exception", "parser", {
      fileType,
      diagnostic: error instanceof Error ? error.message : "unknown",
    });
  }
}
