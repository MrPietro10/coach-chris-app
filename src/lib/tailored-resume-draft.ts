import type { StoredResumeInput } from "@/lib/resume-store";

export type TailoredResumeDraftFields = {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
};

export type TailoredResumeDraft = TailoredResumeDraftFields & {
  notes: string[];
};

function slugifyResumeNameSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildTailoredResumeVersionName(
  jobTitle: string,
  company?: string | null,
): string {
  const jobSlug = slugifyResumeNameSegment(jobTitle) || "role";
  const companySlug = company ? slugifyResumeNameSegment(company) : "";
  if (companySlug) {
    return `resume-${companySlug}-${jobSlug}`.slice(0, 120);
  }
  return `resume-${jobSlug}`.slice(0, 120);
}

export function normalizeTailoredDraftPayload(payload: {
  summary?: unknown;
  skills?: unknown;
  experience?: unknown;
  education?: unknown;
  notes?: unknown;
}): TailoredResumeDraft {
  const skills = Array.isArray(payload.skills)
    ? payload.skills.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];
  const experience = Array.isArray(payload.experience)
    ? payload.experience
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
  const education = Array.isArray(payload.education)
    ? payload.education
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
  const notes = Array.isArray(payload.notes)
    ? payload.notes.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];

  return {
    summary: typeof payload.summary === "string" ? payload.summary.trim() : "",
    skills: skills.join(", "),
    highlights: experience.join("\n"),
    education: education.join("\n"),
    notes: notes.filter((item) => item.length > 0),
  };
}

export function draftFieldsToStoredInput(fields: TailoredResumeDraftFields): StoredResumeInput {
  return {
    summary: fields.summary.trim(),
    skills: fields.skills.trim(),
    highlights: fields.highlights.trim(),
    education: fields.education.trim(),
  };
}
