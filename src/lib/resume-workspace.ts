import type { StoredResumeInput, StoredResumeUploadState } from "@/lib/job-session-store";

export type ResumeWorkspaceSnapshot = {
  stored: StoredResumeInput;
  draft: StoredResumeInput;
  upload: StoredResumeUploadState | null;
  savedAt: string | null;
  parsedAt: string | null;
  activeResumeId?: string | null;
  activeResumeName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sourceFileName?: string | null;
};

export type ResumeWorkspaceHints = {
  previewText: string;
  isReadyForAnalysis: boolean;
  /** True only after a successful file parse that has not been saved yet. */
  needsParseReview: boolean;
  /** True only after explicit save for analysis. */
  isSavedForAnalysis: boolean;
  hasUnsavedEdits: boolean;
  /** Results page: saved resume is actively used for the selected job analysis. */
  isActiveForAnalysis: boolean;
};

function trimFields(input: StoredResumeInput): StoredResumeInput {
  return {
    summary: input.summary.trim(),
    skills: input.skills.trim(),
    highlights: input.highlights.trim(),
    education: input.education.trim(),
  };
}

export function hasResumeFieldContent(input: StoredResumeInput): boolean {
  const fields = trimFields(input);
  return (
    fields.summary.length > 0 ||
    fields.skills.length > 0 ||
    fields.highlights.length > 0 ||
    fields.education.length > 0
  );
}

export function resumeFieldsMatch(a: StoredResumeInput, b: StoredResumeInput): boolean {
  const left = trimFields(a);
  const right = trimFields(b);
  return (
    left.summary === right.summary &&
    left.skills === right.skills &&
    left.highlights === right.highlights &&
    left.education === right.education
  );
}

export function buildResumePreviewText(input: StoredResumeInput): string {
  const fields = trimFields(input);
  if (fields.summary) {
    return fields.summary.length > 72 ? `${fields.summary.slice(0, 72)}…` : fields.summary;
  }
  const highlight = fields.highlights
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (highlight) {
    return highlight.length > 72 ? `${highlight.slice(0, 72)}…` : highlight;
  }
  const skill = fields.skills
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  if (skill) return skill;
  return "";
}

export function getResumeWorkspaceHints(
  snapshot: ResumeWorkspaceSnapshot,
  options?: { inAnalysisContext?: boolean },
): ResumeWorkspaceHints {
  const draft = trimFields(snapshot.draft);
  const stored = trimFields(snapshot.stored);
  const hasDraft = hasResumeFieldContent(draft);
  const hasStored = hasResumeFieldContent(stored);
  const isSavedForAnalysis = Boolean(snapshot.savedAt) && hasStored;
  const needsParseReview = Boolean(snapshot.parsedAt) && !snapshot.savedAt && (hasDraft || hasStored);
  const hasUnsavedEdits =
    isSavedForAnalysis && hasDraft && !resumeFieldsMatch(draft, stored);
  const previewSource = hasDraft ? draft : stored;

  return {
    previewText: buildResumePreviewText(previewSource),
    isReadyForAnalysis: isSavedForAnalysis && !hasUnsavedEdits,
    needsParseReview,
    isSavedForAnalysis,
    hasUnsavedEdits,
    isActiveForAnalysis: Boolean(options?.inAnalysisContext && isSavedForAnalysis && !hasUnsavedEdits),
  };
}
