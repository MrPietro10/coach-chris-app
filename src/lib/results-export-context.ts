import type { ComputedJobAnalysis } from "@/lib/job-session-store";
import {
  mergeContextInputOntoRecord,
  resolveResultsDisplayResume,
  type ResultsResumeContext,
  type ResultsResumeSource,
} from "@/lib/results-resume-context";
import {
  buildResumeExportContactFromProfile,
  buildResumeExportContent,
  buildResumeExportContentFromRecord,
  type ResumeExportContent,
} from "@/lib/resume-export";
import { getResumeRecord, recordToInput, type StoredResumeInput, type StoredResumeRecord } from "@/lib/resume-store";
import { mergeTailoredFieldsWithSource } from "@/lib/tailored-resume-merge";
import type { TailoredResumeDraft } from "@/lib/tailored-resume-draft";
import { buildTailoredResumeVersionName } from "@/lib/tailored-resume-draft";
import type { JobPosting } from "@/types/coach";

export type ResultsExportResolution =
  | {
      kind: "ready";
      content: ResumeExportContent;
      versionName: string;
      usesAnalysisSnapshot: boolean;
    }
  | { kind: "unsaved-tailored-draft"; draft: TailoredResumeDraft };

function usesSnapshotForExport(
  analysisSource: ResultsResumeSource,
  computedAnalysis?: ComputedJobAnalysis | null,
): boolean {
  if (analysisSource !== "snapshot-only") return false;
  return Boolean(computedAnalysis?.resumeSnapshot);
}

function mergeInputOntoRecord(
  record: StoredResumeRecord,
  input: StoredResumeInput,
): StoredResumeRecord {
  return {
    ...record,
    summary: input.summary,
    skills: input.skills,
    experience: input.highlights,
    education: input.education,
    rawText: input.rawText ?? record.rawText,
    candidateName: input.candidateName ?? record.candidateName,
    contactLine: input.contactLine ?? record.contactLine,
    extraSections: input.extraSections ?? record.extraSections,
  };
}

function isTailoredForJob(
  record: StoredResumeRecord | null | undefined,
  jobId: string | undefined,
): boolean {
  return Boolean(jobId && record?.tailoredForJobId === jobId);
}

function buildExportFromInput(options: {
  input: StoredResumeInput;
  versionName: string;
  profileFullName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  contact?: ReturnType<typeof buildResumeExportContactFromProfile>;
  preferJobFilename?: boolean;
  usesAnalysisSnapshot: boolean;
}): {
  content: ResumeExportContent;
  versionName: string;
  usesAnalysisSnapshot: boolean;
} {
  const content = buildResumeExportContent({
    profileFullName: options.profileFullName,
    versionName: options.versionName,
    candidateName: options.input.candidateName,
    contactLine: options.input.contactLine,
    summary: options.input.summary,
    skills: options.input.skills,
    highlights: options.input.highlights,
    education: options.input.education,
    extraSections: options.input.extraSections,
    jobTitle: options.jobTitle,
    company: options.company,
    contact: options.contact,
    preferJobFilename: options.preferJobFilename,
  });
  return {
    content,
    versionName: options.versionName,
    usesAnalysisSnapshot: options.usesAnalysisSnapshot,
  };
}

function buildExportFromRecord(
  record: StoredResumeRecord,
  profileFullName: string | null | undefined,
  jobTitle: string | null | undefined,
  company: string | null | undefined,
  usesAnalysisSnapshot: boolean,
  contact?: ReturnType<typeof buildResumeExportContactFromProfile>,
): {
  content: ResumeExportContent;
  versionName: string;
  usesAnalysisSnapshot: boolean;
} {
  const content = buildResumeExportContentFromRecord(record, profileFullName, {
    jobTitle,
    company,
    contact,
    mergeWithSource: true,
  });
  return { content, versionName: record.name, usesAnalysisSnapshot };
}

function resolveMergedDraftInput(
  draft: TailoredResumeDraft,
  sourceInput?: StoredResumeInput | null,
): StoredResumeInput {
  const draftInput = {
    summary: draft.summary,
    skills: draft.skills,
    highlights: draft.highlights,
    education: draft.education,
  };
  if (!sourceInput) {
    return draftInput;
  }
  return mergeTailoredFieldsWithSource(sourceInput, draftInput);
}

export function resolveResultsExport(options: {
  job: JobPosting | null;
  computedAnalysis?: ComputedJobAnalysis | null;
  resultsResumeContext: ResultsResumeContext;
  savedTailoredVersion: StoredResumeRecord | null;
  tailoredDraft: TailoredResumeDraft | null;
  tailoredDraftSourceInput?: StoredResumeInput | null;
  profileFullName?: string | null;
  profileContact?: {
    location?: string;
    workPermit?: string;
    languages?: string[];
  };
}): ResultsExportResolution {
  const {
    job,
    computedAnalysis,
    resultsResumeContext,
    savedTailoredVersion,
    tailoredDraft,
    tailoredDraftSourceInput,
    profileFullName,
    profileContact,
  } = options;

  const contact = profileContact ? buildResumeExportContactFromProfile(profileContact) : undefined;
  const jobId = job?.id;
  const jobTitle = job?.title ?? null;
  const company = job?.company ?? null;

  if (tailoredDraft) {
    if (tailoredDraftSourceInput) {
      const mergedInput = resolveMergedDraftInput(tailoredDraft, tailoredDraftSourceInput);
      const versionName =
        jobTitle
          ? buildTailoredResumeVersionName(jobTitle, company)
          : "Tailored resume draft";
      const resolved = buildExportFromInput({
        input: mergedInput,
        versionName,
        profileFullName,
        jobTitle,
        company,
        contact,
        preferJobFilename: true,
        usesAnalysisSnapshot: false,
      });
      return { kind: "ready", ...resolved };
    }
    return { kind: "unsaved-tailored-draft", draft: tailoredDraft };
  }

  if (
    savedTailoredVersion &&
    (!jobId || savedTailoredVersion.tailoredForJobId === jobId)
  ) {
    const resolved = buildExportFromRecord(
      savedTailoredVersion,
      profileFullName,
      jobTitle ?? savedTailoredVersion.tailoredForJobTitle,
      company ?? savedTailoredVersion.tailoredForCompany,
      false,
      contact,
    );
    return { kind: "ready", ...resolved };
  }

  const contextRecord = mergeContextInputOntoRecord(resultsResumeContext);
  if (isTailoredForJob(contextRecord, jobId)) {
    const resolved = buildExportFromRecord(
      contextRecord!,
      profileFullName,
      jobTitle ?? contextRecord!.tailoredForJobTitle,
      company ?? contextRecord!.tailoredForCompany,
      false,
      contact,
    );
    return { kind: "ready", ...resolved };
  }

  const analysisContext = resolveResultsDisplayResume(computedAnalysis);
  const useInlineInput = resultsResumeContext.resumeId === analysisContext.resumeId;
  const input = useInlineInput ? resultsResumeContext.input : analysisContext.input;
  const snapshotExport = usesSnapshotForExport(analysisContext.source, computedAnalysis);
  const snapshotProfileName =
    computedAnalysis?.candidateName?.trim() || profileFullName || null;

  if (analysisContext.record) {
    const merged = mergeInputOntoRecord(analysisContext.record, input);
    const sourceRecord = merged.sourceResumeId ? getResumeRecord(merged.sourceResumeId) : null;
    const exportInput =
      merged.tailoredForJobId && sourceRecord
        ? mergeTailoredFieldsWithSource(recordToInput(sourceRecord), recordToInput(merged))
        : recordToInput(merged);
    const resolved = buildExportFromInput({
      input: exportInput,
      versionName: merged.name,
      profileFullName,
      jobTitle,
      company,
      contact,
      preferJobFilename: Boolean(merged.tailoredForJobId),
      usesAnalysisSnapshot: false,
    });
    return { kind: "ready", ...resolved };
  }

  const versionName = analysisContext.resumeName?.trim() || "Resume";
  const content = buildResumeExportContent({
    profileFullName: snapshotProfileName,
    activeResumeName: versionName,
    versionName,
    candidateName: input.candidateName,
    contactLine: input.contactLine,
    summary: input.summary,
    skills: input.skills,
    highlights: input.highlights,
    education: input.education,
    extraSections: input.extraSections,
    jobTitle: jobTitle ?? computedAnalysis?.jobTitle,
    company: company ?? computedAnalysis?.company,
    contact,
    preferJobFilename: Boolean(jobTitle || company),
  });

  return {
    kind: "ready",
    versionName,
    content,
    usesAnalysisSnapshot: snapshotExport,
  };
}
