import { snapshotToStoredInput } from "@/lib/analysis-resume-linkage";
import type { ComputedJobAnalysis } from "@/lib/job-session-store";
import { getPendingAnalysisResumeId } from "@/lib/job-session-store";
import {
  getActiveResumeId,
  getActiveResumeRecord,
  getResumeRecord,
  recordToInput,
  type StoredResumeInput,
  type StoredResumeRecord,
} from "@/lib/resume-store";

export type ResultsResumeSource =
  | "pending"
  | "analysis-linked"
  | "context"
  | "active"
  | "snapshot-only";

export type ResultsResumeContext = {
  resumeId: string | null;
  resumeName: string | null;
  record: StoredResumeRecord | null;
  input: StoredResumeInput;
  source: ResultsResumeSource;
  activeResumeId: string | null;
  activeResumeName: string | null;
  differsFromActive: boolean;
};

function recordFromId(resumeId: string): StoredResumeRecord | null {
  return getResumeRecord(resumeId);
}

function buildContext(
  record: StoredResumeRecord | null,
  input: StoredResumeInput,
  source: ResultsResumeSource,
  resumeName?: string | null,
): ResultsResumeContext {
  const activeRecord = getActiveResumeRecord();
  const activeResumeId = getActiveResumeId();
  const resumeId = record?.id ?? null;
  const resolvedName =
    resumeName?.trim() ||
    record?.name?.trim() ||
    null;

  return {
    resumeId,
    resumeName: resolvedName,
    record,
    input,
    source,
    activeResumeId,
    activeResumeName: activeRecord?.name?.trim() || null,
    differsFromActive: Boolean(
      resumeId && activeResumeId && resumeId !== activeResumeId,
    ),
  };
}

/** Resume version shown and edited on the Results page for a job. */
export function resolveResultsDisplayResume(
  computedAnalysis?: ComputedJobAnalysis | null,
): ResultsResumeContext {
  const linkedId = computedAnalysis?.resumeVersionId?.trim();
  if (linkedId) {
    const linkedRecord = recordFromId(linkedId);
    if (linkedRecord) {
      return buildContext(
        linkedRecord,
        recordToInput(linkedRecord),
        "analysis-linked",
        computedAnalysis?.resumeVersionName,
      );
    }
    const snapshot = computedAnalysis?.resumeSnapshot;
    if (snapshot) {
      return buildContext(
        null,
        snapshotToStoredInput(snapshot),
        "snapshot-only",
        computedAnalysis?.resumeVersionName,
      );
    }
  }

  const pendingId = getPendingAnalysisResumeId();
  if (pendingId) {
    const pendingRecord = recordFromId(pendingId);
    if (pendingRecord) {
      return buildContext(pendingRecord, recordToInput(pendingRecord), "pending");
    }
  }

  const activeRecord = getActiveResumeRecord();
  if (activeRecord) {
    return buildContext(activeRecord, recordToInput(activeRecord), "active");
  }

  return buildContext(null, { summary: "", skills: "", highlights: "", education: "" }, "active");
}

/** Resume version sent to the analysis API (pending selection wins, then context, then linked, then active). */
export function resolveResumeForAnalysisRun(options: {
  computedAnalysis?: ComputedJobAnalysis | null;
  contextResumeId?: string | null;
  inlineInput?: StoredResumeInput;
}): ResultsResumeContext {
  const pendingId = getPendingAnalysisResumeId();
  if (pendingId) {
    const pendingRecord = recordFromId(pendingId);
    if (pendingRecord) {
      return buildContext(
        pendingRecord,
        recordToInput(pendingRecord),
        "pending",
      );
    }
  }

  const contextId = options.contextResumeId?.trim();
  if (contextId) {
    const contextRecord = recordFromId(contextId);
    if (contextRecord) {
      return buildContext(
        contextRecord,
        options.inlineInput ?? recordToInput(contextRecord),
        "context",
      );
    }
  }

  const linkedId = options.computedAnalysis?.resumeVersionId?.trim();
  if (linkedId) {
    const linkedRecord = recordFromId(linkedId);
    if (linkedRecord) {
      return buildContext(
        linkedRecord,
        options.inlineInput ?? recordToInput(linkedRecord),
        "analysis-linked",
        options.computedAnalysis?.resumeVersionName,
      );
    }
    const snapshot = options.computedAnalysis?.resumeSnapshot;
    if (snapshot) {
      return buildContext(
        null,
        options.inlineInput ?? snapshotToStoredInput(snapshot),
        "snapshot-only",
        options.computedAnalysis?.resumeVersionName,
      );
    }
  }

  const activeRecord = getActiveResumeRecord();
  if (activeRecord) {
    return buildContext(
      activeRecord,
      options.inlineInput ?? recordToInput(activeRecord),
      "active",
    );
  }

  return buildContext(
    null,
    options.inlineInput ?? { summary: "", skills: "", highlights: "", education: "" },
    "active",
  );
}

export function getResultsResumeLabel(context: ResultsResumeContext): string | null {
  return context.resumeName;
}

/** Merge current inline fields onto the context record for export. */
export function mergeContextInputOntoRecord(
  context: ResultsResumeContext,
): StoredResumeRecord | null {
  if (!context.record) return null;
  return {
    ...context.record,
    summary: context.input.summary,
    skills: context.input.skills,
    experience: context.input.highlights,
    education: context.input.education,
  };
}
