import {
  getResumePersistenceState,
  getResumeWorkspaceSnapshot,
  getStoredResumeInput,
  getStoredResumeUploadState,
  type StoredResumeInput,
  type StoredResumeUploadState,
} from "@/lib/resume-store";
import { getResumeWorkspaceHints, type ResumeWorkspaceSnapshot } from "@/lib/resume-workspace";
import type { ResumeParseFlowStatus } from "@/lib/resume-upload";

export function buildResumeWorkspaceSnapshotFromInput(
  draft: StoredResumeInput,
): ResumeWorkspaceSnapshot {
  return getResumeWorkspaceSnapshot(draft);
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
