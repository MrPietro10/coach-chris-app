import { readAlphaScopedStorageItem } from "@/lib/alpha-scoped-storage";
import { writeScopedJson } from "@/lib/alpha-scoped-json-write";
import type { TailoredResumeDraft } from "@/lib/tailored-resume-draft";

export const PENDING_TAILORED_DRAFT_MESSAGE = "You have an unsaved tailored resume draft.";

export type PendingTailoredResumeDraft = {
  draftId: string;
  sourceResumeId: string;
  sourceResumeName: string;
  tailoredForJobId: string;
  tailoredForJobTitle: string;
  tailoredForCompany: string;
  summary: string;
  skills: string;
  experience: string;
  education: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function buildDraftId(): string {
  return `tailor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeDraft(raw: unknown): PendingTailoredResumeDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Partial<PendingTailoredResumeDraft>;
  const tailoredForJobId =
    typeof entry.tailoredForJobId === "string" ? entry.tailoredForJobId.trim() : "";
  if (!tailoredForJobId) return null;

  const summary = typeof entry.summary === "string" ? entry.summary : "";
  const skills = typeof entry.skills === "string" ? entry.skills : "";
  const experience = typeof entry.experience === "string" ? entry.experience : "";
  const education = typeof entry.education === "string" ? entry.education : "";
  const hasContent =
    summary.trim() || skills.trim() || experience.trim() || education.trim();
  if (!hasContent) return null;

  const notes = Array.isArray(entry.notes)
    ? entry.notes.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];
  const now = new Date().toISOString();

  return {
    draftId:
      typeof entry.draftId === "string" && entry.draftId.trim().length > 0
        ? entry.draftId.trim()
        : buildDraftId(),
    sourceResumeId: typeof entry.sourceResumeId === "string" ? entry.sourceResumeId : "",
    sourceResumeName:
      typeof entry.sourceResumeName === "string" ? entry.sourceResumeName : "Resume",
    tailoredForJobId,
    tailoredForJobTitle:
      typeof entry.tailoredForJobTitle === "string" ? entry.tailoredForJobTitle : "",
    tailoredForCompany:
      typeof entry.tailoredForCompany === "string" ? entry.tailoredForCompany : "",
    summary,
    skills,
    experience,
    education,
    notes: notes.filter((item) => item.length > 0),
    createdAt: isIsoTimestamp(entry.createdAt) ? entry.createdAt : now,
    updatedAt: isIsoTimestamp(entry.updatedAt) ? entry.updatedAt : now,
  };
}

function readAllDrafts(): PendingTailoredResumeDraft[] {
  if (!isBrowser()) return [];
  const raw = readAlphaScopedStorageItem("pending-tailored-drafts");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeDraft(entry))
      .filter((entry): entry is PendingTailoredResumeDraft => entry !== null);
  } catch {
    return [];
  }
}

function writeAllDrafts(drafts: PendingTailoredResumeDraft[]): boolean {
  if (!isBrowser()) return false;
  return writeScopedJson("pending-tailored-drafts", drafts);
}

export function pendingToTailoredDraft(draft: PendingTailoredResumeDraft): TailoredResumeDraft {
  return {
    summary: draft.summary,
    skills: draft.skills,
    highlights: draft.experience,
    education: draft.education,
    notes: draft.notes,
  };
}

export function buildPendingTailoredDraft(options: {
  job: { id: string; title: string; company: string };
  sourceResume?: { id: string; name: string } | null;
  draft: TailoredResumeDraft;
  existingDraftId?: string | null;
  existingCreatedAt?: string | null;
}): PendingTailoredResumeDraft {
  const now = new Date().toISOString();
  return {
    draftId: options.existingDraftId?.trim() || buildDraftId(),
    sourceResumeId: options.sourceResume?.id?.trim() ?? "",
    sourceResumeName: options.sourceResume?.name?.trim() || "Resume",
    tailoredForJobId: options.job.id,
    tailoredForJobTitle: options.job.title,
    tailoredForCompany: options.job.company,
    summary: options.draft.summary,
    skills: options.draft.skills,
    experience: options.draft.highlights,
    education: options.draft.education,
    notes: options.draft.notes,
    createdAt: options.existingCreatedAt?.trim() || now,
    updatedAt: now,
  };
}

export function getPendingTailoredDraftForJob(jobId: string): PendingTailoredResumeDraft | null {
  const trimmed = jobId.trim();
  if (!trimmed) return null;
  return readAllDrafts().find((draft) => draft.tailoredForJobId === trimmed) ?? null;
}

export function getPendingTailoredDraftForJobAndSource(
  jobId: string,
  sourceResumeId: string | null | undefined,
): PendingTailoredResumeDraft | null {
  const trimmedJobId = jobId.trim();
  if (!trimmedJobId) return null;
  const normalizedSourceId = sourceResumeId?.trim() ?? "";
  return (
    readAllDrafts().find(
      (draft) =>
        draft.tailoredForJobId === trimmedJobId &&
        (draft.sourceResumeId.trim() || "") === normalizedSourceId,
    ) ?? null
  );
}

export function hasPendingTailoredDraftForJob(jobId: string): boolean {
  return getPendingTailoredDraftForJob(jobId) !== null;
}

export function savePendingTailoredDraft(draft: PendingTailoredResumeDraft): boolean {
  const drafts = readAllDrafts().filter(
    (entry) => entry.tailoredForJobId !== draft.tailoredForJobId,
  );
  return writeAllDrafts([draft, ...drafts]);
}

export function clearPendingTailoredDraftForJob(jobId: string): void {
  const trimmed = jobId.trim();
  if (!trimmed) return;
  const next = readAllDrafts().filter((draft) => draft.tailoredForJobId !== trimmed);
  writeAllDrafts(next);
}

export function clearPendingTailoredDraftById(draftId: string): void {
  const trimmed = draftId.trim();
  if (!trimmed) return;
  const next = readAllDrafts().filter((draft) => draft.draftId !== trimmed);
  writeAllDrafts(next);
}

export function clearAllPendingTailoredDrafts(): void {
  writeAllDrafts([]);
}

export function clearPendingTailoredDraftsForJobs(jobIds: Iterable<string>): void {
  const drop = new Set([...jobIds].map((id) => id.trim()).filter(Boolean));
  if (drop.size === 0) return;
  const next = readAllDrafts().filter((draft) => !drop.has(draft.tailoredForJobId));
  writeAllDrafts(next);
}
