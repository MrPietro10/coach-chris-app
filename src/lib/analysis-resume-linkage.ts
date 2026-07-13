import type { ComputedJobAnalysis } from "@/lib/job-session-store";
import { createResumeVersionFromInput, type StoredResumeRecord } from "@/lib/resume-store";

export type AnalysisResumeSnapshot = {
  summary: string;
  skills: string;
  experience: string;
  education: string;
  rawText?: string;
  candidateName?: string;
  contactLine?: string;
  extraSections?: Array<{ heading: string; content: string }>;
};

export type AnalysisResumeLinkFields = {
  resumeVersionId?: string;
  resumeVersionName?: string;
  candidateName?: string;
  jobTitle?: string;
  company?: string;
  createdAt?: string;
  snapshotCreatedAt?: string;
  resumeSnapshot?: AnalysisResumeSnapshot;
};

export function buildAnalysisResumeSnapshotFromInput(input: {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
  rawText?: string;
  candidateName?: string;
  contactLine?: string;
  extraSections?: Array<{ heading: string; content: string }>;
}): AnalysisResumeSnapshot {
  return {
    summary: input.summary.trim(),
    skills: input.skills.trim(),
    experience: input.highlights.trim(),
    education: input.education.trim(),
    rawText: input.rawText?.trim() || undefined,
    candidateName: input.candidateName?.trim() || undefined,
    contactLine: input.contactLine?.trim() || undefined,
    extraSections: input.extraSections?.filter((section) => section.heading.trim() && section.content.trim()),
  };
}

export function snapshotToStoredInput(snapshot: AnalysisResumeSnapshot): {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
  rawText?: string;
  candidateName?: string;
  contactLine?: string;
  extraSections?: Array<{ heading: string; content: string }>;
} {
  return {
    summary: snapshot.summary.trim(),
    skills: snapshot.skills.trim(),
    highlights: snapshot.experience.trim(),
    education: snapshot.education.trim(),
    rawText: snapshot.rawText?.trim() || undefined,
    candidateName: snapshot.candidateName?.trim() || undefined,
    contactLine: snapshot.contactLine?.trim() || undefined,
    extraSections: snapshot.extraSections?.filter((section) => section.heading.trim() && section.content.trim()) ?? [],
  };
}

export function enrichComputedJobAnalysisWithResumeLink(
  analysis: ComputedJobAnalysis,
  context: {
    job: { id: string; title: string; company: string };
    resumeVersion: { id: string; name: string } | null;
    resumeSnapshot: AnalysisResumeSnapshot;
    candidateName?: string | null;
  },
): ComputedJobAnalysis {
  const now = new Date().toISOString();
  const candidateName = context.candidateName?.trim() || undefined;

  return {
    ...analysis,
    resumeVersionId: context.resumeVersion?.id,
    resumeVersionName: context.resumeVersion?.name,
    candidateName,
    jobTitle: context.job.title,
    company: context.job.company,
    createdAt: now,
    snapshotCreatedAt: now,
    resumeSnapshot: context.resumeSnapshot,
  };
}

export function buildRestoredSnapshotVersionName(analysis: ComputedJobAnalysis): string {
  const baseName = analysis.resumeVersionName?.trim() || "Analysis snapshot";
  return baseName.endsWith("(restored)") ? baseName : `${baseName} (restored)`;
}

/** Recreate a stored resume version from the analysis-linked snapshot fields. */
export function restoreAnalysisSnapshotAsResumeVersion(
  analysis: ComputedJobAnalysis,
  options?: { setActive?: boolean },
): StoredResumeRecord | null {
  const snapshot = analysis.resumeSnapshot;
  if (!snapshot) return null;

  return createResumeVersionFromInput(snapshotToStoredInput(snapshot), {
    name: buildRestoredSnapshotVersionName(analysis),
    setActive: options?.setActive !== false,
  });
}

export function sanitizeAnalysisResumeSnapshot(raw: unknown): AnalysisResumeSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const entry = raw as Partial<AnalysisResumeSnapshot>;
  const summary = typeof entry.summary === "string" ? entry.summary : "";
  const skills = typeof entry.skills === "string" ? entry.skills : "";
  const experience = typeof entry.experience === "string" ? entry.experience : "";
  const education = typeof entry.education === "string" ? entry.education : "";
  if (!summary && !skills && !experience && !education) return undefined;
  const candidateName =
    typeof entry.candidateName === "string" && entry.candidateName.trim().length > 0
      ? entry.candidateName.trim()
      : undefined;
  const contactLine =
    typeof entry.contactLine === "string" && entry.contactLine.trim().length > 0
      ? entry.contactLine.trim()
      : undefined;
  const rawText =
    typeof entry.rawText === "string" && entry.rawText.trim().length > 0 ? entry.rawText.trim() : undefined;
  const extraSections = Array.isArray(entry.extraSections)
    ? entry.extraSections
        .map((section) => {
          if (!section || typeof section !== "object") return null;
          const parsed = section as Partial<{ heading: string; content: string }>;
          const heading = typeof parsed.heading === "string" ? parsed.heading.trim() : "";
          const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
          if (!heading || !content) return null;
          return { heading, content };
        })
        .filter((section): section is { heading: string; content: string } => section !== null)
    : [];
  return { summary, skills, experience, education, rawText, candidateName, contactLine, extraSections };
}

export function getAnalysisResumeVersionLabel(analysis: ComputedJobAnalysis | undefined): string | null {
  const name = analysis?.resumeVersionName?.trim();
  return name && name.length > 0 ? name : null;
}
