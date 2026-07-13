import { readAlphaScopedStorageItem, removeAlphaScopedStorageItem } from "@/lib/alpha-scoped-storage";
import { writeScopedJson } from "@/lib/alpha-scoped-json-write";
import type { StoredResumeAdditionalSection, StoredResumeInput } from "@/lib/resume-store";

export const PENDING_PARSE_DRAFT_MESSAGE = "You have a resume draft ready to review.";

export type PendingParseDraft = {
  sourceFileName: string;
  parsedAt: string;
  summary: string;
  skills: string;
  highlights: string;
  education: string;
  rawText?: string;
  candidateName?: string;
  contactLine?: string;
  extraSections?: StoredResumeAdditionalSection[];
  fileType?: "pdf" | "docx";
  uploadedAt?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function sanitizeDraft(raw: unknown): PendingParseDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Partial<PendingParseDraft>;
  const sourceFileName = typeof entry.sourceFileName === "string" ? entry.sourceFileName.trim() : "";
  const parsedAt = typeof entry.parsedAt === "string" ? entry.parsedAt.trim() : "";
  const summary = typeof entry.summary === "string" ? entry.summary : "";
  const skills = typeof entry.skills === "string" ? entry.skills : "";
  const highlights = typeof entry.highlights === "string" ? entry.highlights : "";
  const education = typeof entry.education === "string" ? entry.education : "";
  const rawText = typeof entry.rawText === "string" ? entry.rawText : "";
  const candidateName = typeof entry.candidateName === "string" ? entry.candidateName.trim() : "";
  const contactLine = typeof entry.contactLine === "string" ? entry.contactLine.trim() : "";
  if (!parsedAt) return null;
  const hasContent =
    summary.trim() || skills.trim() || highlights.trim() || education.trim();
  if (!hasContent) return null;

  const fileType = entry.fileType === "pdf" || entry.fileType === "docx" ? entry.fileType : undefined;
  const uploadedAt =
    typeof entry.uploadedAt === "string" && entry.uploadedAt.trim().length > 0
      ? entry.uploadedAt.trim()
      : undefined;

  return {
    sourceFileName: sourceFileName || "Uploaded resume",
    parsedAt,
    summary,
    skills,
    highlights,
    education,
    rawText: rawText.trim() || undefined,
    candidateName: candidateName || undefined,
    contactLine: contactLine || undefined,
    extraSections: Array.isArray(entry.extraSections)
      ? entry.extraSections
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const section = item as Partial<StoredResumeAdditionalSection>;
            const heading = typeof section.heading === "string" ? section.heading.trim() : "";
            const content = typeof section.content === "string" ? section.content.trim() : "";
            if (!heading || !content) return null;
            return { heading, content };
          })
          .filter((item): item is StoredResumeAdditionalSection => item !== null)
      : [],
    fileType,
    uploadedAt,
  };
}

export function pendingParseDraftToInput(draft: PendingParseDraft): StoredResumeInput {
  return {
    summary: draft.summary,
    skills: draft.skills,
    highlights: draft.highlights,
    education: draft.education,
    rawText: draft.rawText,
    candidateName: draft.candidateName,
    contactLine: draft.contactLine,
    extraSections: draft.extraSections ?? [],
  };
}

export function savePendingParseDraft(draft: PendingParseDraft): boolean {
  if (!isBrowser()) return false;
  return writeScopedJson("pending-parse-draft", draft);
}

export function getPendingParseDraft(): PendingParseDraft | null {
  if (!isBrowser()) return null;
  const raw = readAlphaScopedStorageItem("pending-parse-draft");
  if (!raw) return null;
  try {
    return sanitizeDraft(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function clearPendingParseDraft(): void {
  if (!isBrowser()) return;
  removeAlphaScopedStorageItem("pending-parse-draft");
}

export function hasPendingParseDraft(): boolean {
  return getPendingParseDraft() !== null;
}
