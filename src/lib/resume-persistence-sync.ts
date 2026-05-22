import {
  getResumePersistenceState,
  getStoredResumeInput,
  getStoredResumeUploadState,
  type StoredResumeInput,
  type StoredResumeUploadState,
} from "@/lib/job-session-store";
import { getResumeWorkspaceHints, type ResumeWorkspaceSnapshot } from "@/lib/resume-workspace";
import type { ResumeParseFlowStatus } from "@/lib/resume-upload";

export function buildResumeWorkspaceSnapshotFromInput(
  draft: StoredResumeInput,
): ResumeWorkspaceSnapshot {
  const persistence = getResumePersistenceState();
  return {
    stored: persistence.input,
    draft,
    upload: persistence.upload,
    savedAt: persistence.savedAt,
    parsedAt: persistence.parsedAt,
  };
}

export function deriveResumeFlowStatus(draft?: StoredResumeInput): ResumeParseFlowStatus {
  const snapshot = buildResumeWorkspaceSnapshotFromInput(draft ?? getStoredResumeInput());
  const hints = getResumeWorkspaceHints(snapshot);
  if (hints.isSavedForAnalysis && !hints.hasUnsavedEdits) return "resume_ready";
  if (hints.needsParseReview) return "parse_success";
  return "idle";
}

export type ResumeUiSyncState = {
  fields: StoredResumeInput;
  upload: StoredResumeUploadState | null;
  flowStatus: ResumeParseFlowStatus;
  parsedFileType?: "pdf" | "docx";
};

export function readResumeUiSyncState(draft?: StoredResumeInput): ResumeUiSyncState {
  const persistence = getResumePersistenceState();
  const fields = draft ?? persistence.input;
  return {
    fields,
    upload: getStoredResumeUploadState(),
    flowStatus: deriveResumeFlowStatus(fields),
    parsedFileType: persistence.upload?.fileType,
  };
}
