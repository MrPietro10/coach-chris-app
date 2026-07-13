import {
  getPendingAnalysisResumeId,
  getStoredResumeInput,
} from "@/lib/job-session-store";
import {
  getActiveResumeRecord,
  getResumeRecord,
  recordToInput,
  type StoredResumeInput,
  type StoredResumeRecord,
} from "@/lib/resume-store";

export function getPendingOrActiveResumeRecord(): StoredResumeRecord | null {
  const pendingResumeId = getPendingAnalysisResumeId();
  if (pendingResumeId) {
    return getResumeRecord(pendingResumeId) ?? getActiveResumeRecord();
  }
  return getActiveResumeRecord();
}

export function getStoredResumeInputForAnalysis(
  inlineInput?: StoredResumeInput,
): StoredResumeInput {
  const pendingResumeId = getPendingAnalysisResumeId();
  if (pendingResumeId) {
    const pendingRecord = getResumeRecord(pendingResumeId);
    if (pendingRecord) {
      return recordToInput(pendingRecord);
    }
  }
  if (inlineInput) {
    return inlineInput;
  }
  return getStoredResumeInput();
}

export function isResumeRecordReadyForAnalysis(record: StoredResumeRecord): boolean {
  const input = recordToInput(record);
  const hasContent =
    input.summary.trim().length > 0 ||
    input.skills.trim().length > 0 ||
    input.highlights.trim().length > 0 ||
    input.education.trim().length > 0;
  return hasContent && Boolean(record.savedAt);
}
