import type { StoredResumeInput } from "@/lib/job-session-store";

export type AnalysisResumeContext = {
  summary: string;
  skills: string[];
  experienceHighlights: string[];
  educationEntries: string[];
};

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitLineList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function buildAnalysisResumeContext(input: {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
}): AnalysisResumeContext {
  const summary = input.summary.trim();
  const skills = splitCommaList(input.skills);
  const experienceHighlights = splitLineList(input.highlights);
  const educationEntries = splitLineList(input.education);

  if (summary.length > 0) {
    return { summary, skills, experienceHighlights, educationEntries };
  }

  const fallbackSummary = [skills.join(", "), experienceHighlights.join("\n")]
    .filter((item) => item.length > 0)
    .join("\n\n");

  return {
    summary: fallbackSummary,
    skills,
    experienceHighlights,
    educationEntries,
  };
}

export function buildAnalysisResumeContextFromStored(
  stored: StoredResumeInput,
): AnalysisResumeContext {
  return buildAnalysisResumeContext({
    summary: stored.summary,
    skills: stored.skills,
    highlights: stored.highlights,
    education: stored.education,
  });
}

export function hasAnalysisResumeContext(context: AnalysisResumeContext): boolean {
  return (
    context.summary.trim().length > 0 ||
    context.skills.length > 0 ||
    context.experienceHighlights.length > 0 ||
    context.educationEntries.length > 0
  );
}
