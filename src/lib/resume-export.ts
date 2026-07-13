import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type {
  StoredResumeAdditionalSection,
  StoredResumeInput,
  StoredResumeRecord,
} from "@/lib/resume-store";
import { getResumeRecord, recordToInput } from "@/lib/resume-store";
import { mergeTailoredFieldsWithSource } from "@/lib/tailored-resume-merge";

export type ResumeExportFormat = "docx";

/**
 * PDF export is intentionally disabled for alpha.
 * See `resume-pdf-export-readiness.ts` — implement PDF only after DOCX export is faithful.
 */
export const RESUME_PDF_EXPORT_ENABLED = false;

export type ResumeExportContact = {
  primaryLine?: string;
  location?: string;
  workPermit?: string;
  languages?: string[];
};

export type ResumeExportContent = {
  displayName: string;
  versionName: string;
  filenameSlug: string;
  contact?: ResumeExportContact;
  summary: string;
  skills: string[];
  experience: string[];
  education: string[];
  extraSections: StoredResumeAdditionalSection[];
  sourceFileType?: "pdf" | "docx";
  sourceFileName?: string;
};

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitLineList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function sanitizeAdditionalSections(raw: StoredResumeAdditionalSection[] | undefined): StoredResumeAdditionalSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((section) => ({
      heading: section.heading.trim(),
      content: section.content.trim(),
    }))
    .filter((section) => section.heading.length > 0 && section.content.length > 0);
}

function slugifyFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function looksLikePersonName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  if (/^(resume(\s*\d+)?|untitled resume|imported resume)/i.test(trimmed)) {
    return false;
  }
  if (/^resume-[a-z0-9-]+$/i.test(trimmed)) {
    return false;
  }
  return /[a-zA-Z]/.test(trimmed);
}

function inferCandidateNameSlug(
  profileFullName?: string | null,
  activeResumeName?: string | null,
): string {
  const fromProfile = slugifyFilenamePart(profileFullName ?? "");
  if (fromProfile && looksLikePersonName(profileFullName ?? "")) {
    return fromProfile;
  }

  const fromResumeName = slugifyFilenamePart(activeResumeName ?? "");
  if (fromResumeName && looksLikePersonName(activeResumeName ?? "")) {
    return fromResumeName;
  }

  return "";
}

export function buildTailoredJobExportFilenameSlug(
  jobTitle?: string | null,
  company?: string | null,
): string | null {
  const companySlug = slugifyFilenamePart(company ?? "");
  const jobSlug = slugifyFilenamePart(jobTitle ?? "");
  if (companySlug && jobSlug) {
    return `${companySlug}-${jobSlug}`.slice(0, 160);
  }
  if (jobSlug) return jobSlug;
  if (companySlug) return companySlug;
  return null;
}

export function buildResumeExportFilenameSlug(options: {
  profileFullName?: string | null;
  versionName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  preferJobFilename?: boolean;
}): string {
  const tailoredSlug = buildTailoredJobExportFilenameSlug(options.jobTitle, options.company);
  if (options.preferJobFilename && tailoredSlug) {
    return tailoredSlug;
  }
  if (tailoredSlug && (options.jobTitle || options.company)) {
    return tailoredSlug;
  }

  const versionName = options.versionName?.trim() || null;
  const candidateSlug = inferCandidateNameSlug(options.profileFullName, versionName);
  const versionSlug = slugifyFilenamePart(versionName ?? "");

  if (versionSlug && versionSlug.startsWith("resume-")) {
    return versionSlug.slice("resume-".length).slice(0, 160);
  }

  if (candidateSlug && versionSlug) {
    return `${candidateSlug}-${versionSlug}`.slice(0, 160);
  }
  if (versionSlug) return versionSlug.slice(0, 160);
  return candidateSlug || "version";
}

/** @deprecated Use buildResumeExportFilenameSlug */
export function buildTailoredResumeExportFilenameSlug(options: {
  profileFullName?: string | null;
  activeResumeName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
}): string {
  return buildResumeExportFilenameSlug({
    profileFullName: options.profileFullName,
    versionName: options.activeResumeName,
    jobTitle: options.jobTitle,
    company: options.company,
    preferJobFilename: true,
  });
}

/** @deprecated Use buildResumeExportFilenameSlug */
export function inferResumeExportFilenameSlug(options: {
  profileFullName?: string | null;
  activeResumeName?: string | null;
}): string {
  return buildResumeExportFilenameSlug({
    profileFullName: options.profileFullName,
    versionName: options.activeResumeName,
  });
}

export function buildResumeExportFilename(slug: string, format: ResumeExportFormat = "docx"): string {
  const normalized = slug.replace(/^resume-/, "");
  return `resume-${normalized}.${format}`;
}

export function buildResumeExportContactFromProfile(profile: {
  location?: string;
  workPermit?: string;
  languages?: string[];
}): ResumeExportContact | undefined {
  const location = profile.location?.trim();
  const workPermit = profile.workPermit?.trim();
  const languages = Array.isArray(profile.languages)
    ? profile.languages.map((item) => item.trim()).filter((item) => item.length > 0)
    : [];

  if (!location && !workPermit && languages.length === 0) {
    return undefined;
  }

  return {
    location: location || undefined,
    workPermit: workPermit || undefined,
    languages: languages.length > 0 ? languages : undefined,
  };
}

export function buildResumeExportContent(input: {
  profileFullName?: string | null;
  activeResumeName?: string | null;
  versionName?: string | null;
  candidateName?: string | null;
  contactLine?: string | null;
  summary: string;
  skills: string;
  highlights: string;
  education: string;
  extraSections?: StoredResumeAdditionalSection[];
  sourceFileType?: "pdf" | "docx";
  sourceFileName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  tailoredForJobTitle?: string | null;
  tailoredForCompany?: string | null;
  contact?: ResumeExportContact;
  preferJobFilename?: boolean;
}): ResumeExportContent {
  const versionName =
    input.versionName?.trim() ||
    input.activeResumeName?.trim() ||
    "Resume";
  const jobTitle = input.jobTitle ?? input.tailoredForJobTitle;
  const company = input.company ?? input.tailoredForCompany;

  const filenameSlug = buildResumeExportFilenameSlug({
    profileFullName: input.profileFullName,
    versionName,
    jobTitle,
    company,
    preferJobFilename: input.preferJobFilename ?? Boolean(jobTitle || company),
  });

  const displayName =
    input.candidateName?.trim() ||
    input.profileFullName?.trim() ||
    (looksLikePersonName(versionName) ? versionName : "");

  return {
    displayName: displayName || "Resume",
    versionName,
    filenameSlug,
    contact: {
      ...input.contact,
      primaryLine: input.contactLine?.trim() || input.contact?.primaryLine,
    },
    summary: input.summary.trim(),
    skills: splitCommaList(input.skills),
    experience: splitLineList(input.highlights),
    education: splitLineList(input.education),
    extraSections: sanitizeAdditionalSections(input.extraSections),
    sourceFileType: input.sourceFileType,
    sourceFileName: input.sourceFileName?.trim() || undefined,
  };
}

export function buildMergedExportInputFromRecord(record: StoredResumeRecord): StoredResumeInput {
  const current = recordToInput(record);
  if (!record.sourceResumeId) {
    return current;
  }
  const source = getResumeRecord(record.sourceResumeId);
  if (!source) {
    return current;
  }
  const merged = mergeTailoredFieldsWithSource(recordToInput(source), current);
  return {
    ...merged,
    rawText: current.rawText ?? recordToInput(source).rawText,
    candidateName: current.candidateName ?? recordToInput(source).candidateName,
    contactLine: current.contactLine ?? recordToInput(source).contactLine,
    extraSections: current.extraSections?.length ? current.extraSections : recordToInput(source).extraSections,
  };
}

export function buildResumeExportContentFromRecord(
  record: StoredResumeRecord,
  profileFullName?: string | null,
  options?: {
    jobTitle?: string | null;
    company?: string | null;
    contact?: ResumeExportContact;
    mergeWithSource?: boolean;
  },
): ResumeExportContent {
  const input =
    options?.mergeWithSource === false
      ? recordToInput(record)
      : buildMergedExportInputFromRecord(record);

  return buildResumeExportContent({
    profileFullName,
    activeResumeName: record.name,
    versionName: record.name,
    candidateName: record.candidateName,
    contactLine: record.contactLine,
    summary: input.summary,
    skills: input.skills,
    highlights: input.highlights,
    education: input.education,
    extraSections: input.extraSections,
    sourceFileType: record.uploadFileType,
    sourceFileName: record.sourceFileName,
    jobTitle: options?.jobTitle ?? record.tailoredForJobTitle,
    company: options?.company ?? record.tailoredForCompany,
    contact: options?.contact,
    preferJobFilename: Boolean(record.tailoredForJobId),
  });
}

export function buildResumeExportPlainText(content: ResumeExportContent): string {
  const contactParts = [
    content.contact?.primaryLine,
    [content.contact?.location, content.contact?.workPermit, content.contact?.languages?.join(", ")]
      .filter((item): item is string => Boolean(item && item.trim().length > 0))
      .join(" · "),
  ].filter((item): item is string => Boolean(item && item.trim().length > 0));

  const skillsBlock =
    content.skills.length > 0
      ? content.skills.map((item) => `• ${item}`).join("\n")
      : "• (none)";

  const experienceBlock =
    content.experience.length > 0
      ? formatPlainTextSectionLines(content.experience)
      : "• (none)";

  const educationBlock =
    content.education.length > 0
      ? formatPlainTextSectionLines(content.education)
      : "• (none)";

  const extraBlocks = content.extraSections.flatMap((section) => [
    "",
    section.heading.toUpperCase(),
    formatPlainTextSectionLines(splitLineList(section.content)),
  ]);

  return [
    content.displayName,
    contactParts.length > 0 ? contactParts.join(" · ") : null,
    "",
    "SUMMARY",
    content.summary || "(not provided)",
    "",
    "SKILLS",
    skillsBlock,
    "",
    "EXPERIENCE",
    experienceBlock,
    "",
    "EDUCATION",
    educationBlock,
    ...extraBlocks,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function formatPlainTextSectionLines(lines: string[]): string {
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      if (isExperienceHeading(trimmed)) {
        return trimmed;
      }
      return `• ${stripBulletPrefix(trimmed)}`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function isExperienceHeading(line: string): boolean {
  if (/\d{4}/.test(line)) return true;
  if (line.includes("|")) return true;
  if (/\bat\s+[A-Z]/.test(line) && line.length < 120) return true;
  return false;
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[-•*–—]\s+/, "").trim();
}

function sectionHeading(text: string, isFirstSection = false): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: isFirstSection ? 160 : 220, after: 80 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        color: "1F2937",
      }),
    ],
  });
}

function buildSecondaryContactLine(contact: ResumeExportContact): string | null {
  const parts = [
    contact.location,
    contact.workPermit,
    contact.languages?.join(", "),
  ].filter((item): item is string => Boolean(item && item.trim().length > 0));

  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function contactParagraphs(contact: ResumeExportContact): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const primaryLine = contact.primaryLine?.trim();
  const secondaryLine = buildSecondaryContactLine(contact);

  if (primaryLine) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: secondaryLine ? 60 : 120, line: 240 },
          alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: primaryLine, size: 19, color: "374151" })],
      }),
    );
  }

  if (secondaryLine) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 140, line: 240 },
          alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: secondaryLine, size: 19, color: "4B5563" })],
      }),
    );
  }

  return paragraphs;
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 50, line: 240 },
    indent: { left: 360, hanging: 180 },
    children: [new TextRun({ text, size: 21, color: "111827" })],
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 90, line: 240 },
    children: [new TextRun({ text, size: 21, color: "111827" })],
  });
}

function bulletSection(items: string[]): Paragraph[] {
  if (items.length === 0) {
    return [bodyParagraph("(none)")];
  }
  return items.map((item) => bulletParagraph(stripBulletPrefix(item)));
}

function structuredLineSection(lines: string[]): Paragraph[] {
  if (lines.length === 0) {
    return [bodyParagraph("(none)")];
  }

  const paragraphs: Paragraph[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isExperienceHeading(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: paragraphs.length === 0 ? 0 : 120, after: 30, line: 240 },
          children: [
            new TextRun({
              text: stripBulletPrefix(trimmed),
              bold: true,
              size: 21,
              color: "111827",
            }),
          ],
        }),
      );
      continue;
    }
    paragraphs.push(bulletParagraph(trimmed));
  }
  return paragraphs.length > 0 ? paragraphs : [bodyParagraph("(none)")];
}

function additionalSectionParagraphs(sections: StoredResumeAdditionalSection[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const section of sections) {
    paragraphs.push(sectionHeading(section.heading));
    paragraphs.push(...structuredLineSection(splitLineList(section.content)));
  }
  return paragraphs;
}

export async function exportResumeAsDocx(content: ResumeExportContent): Promise<Blob> {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 60 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: content.displayName,
          bold: true,
          size: 34,
          color: "111827",
        }),
      ],
    }),
  ];

  if (content.contact) {
    paragraphs.push(...contactParagraphs(content.contact));
  }

  paragraphs.push(
    sectionHeading("Summary", true),
    bodyParagraph(content.summary || "(not provided)"),
    sectionHeading("Skills"),
    ...bulletSection(content.skills),
    sectionHeading("Experience"),
    ...structuredLineSection(content.experience),
    sectionHeading("Education"),
    ...structuredLineSection(content.education),
    ...additionalSectionParagraphs(content.extraSections),
  );

  const resumeDoc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Aptos",
            size: 21,
            color: "111827",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 900,
              bottom: 720,
              left: 900,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  return Packer.toBlob(resumeDoc);
}

export function buildResumeExportNotice(versionName: string, content?: ResumeExportContent): string {
  const base = `Exporting a Coach Chris formatted resume based on ${versionName}.`;
  if (content?.sourceFileType === "pdf") {
    return `${base} Original PDF layout is not preserved in beta.`;
  }
  if (content?.sourceFileType === "docx") {
    return `${base} Original DOCX formatting preservation is a future enhancement.`;
  }
  return base;
}

export async function downloadResumeExport(
  content: ResumeExportContent,
  format: ResumeExportFormat = "docx",
): Promise<void> {
  if (format !== "docx") {
    throw new Error("Only DOCX export is available. PDF is deferred until DOCX fidelity is stable.");
  }

  // TODO: Add PDF export only after DOCX content fidelity is stable.
  // Exact original PDF layout preservation needs DOCX/template support or a later document pipeline.
  // Future path for DOCX uploads: preserve DOCX formatting where possible.
  const blob = await exportResumeAsDocx(content);
  const filename = buildResumeExportFilename(content.filenameSlug, format);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
