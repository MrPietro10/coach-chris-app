import type { StoredResumeInput } from "@/lib/job-session-store";

export type AnalysisResumeContext = {
  summary: string;
  skills: string[];
  experienceHighlights: string[];
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
}): AnalysisResumeContext {
  const summary = input.summary.trim();
  const skills = splitCommaList(input.skills);
  const experienceHighlights = splitLineList(input.highlights);

  if (summary.length > 0) {
    return { summary, skills, experienceHighlights };
  }

  const fallbackSummary = [skills.join(", "), experienceHighlights.join("\n")]
    .filter((item) => item.length > 0)
    .join("\n\n");

  return {
    summary: fallbackSummary,
    skills,
    experienceHighlights,
  };
}

export function buildAnalysisResumeContextFromStored(
  stored: StoredResumeInput,
): AnalysisResumeContext {
  return buildAnalysisResumeContext({
    summary: stored.summary,
    skills: stored.skills,
    highlights: stored.highlights,
  });
}

export function hasAnalysisResumeContext(context: AnalysisResumeContext): boolean {
  return (
    context.summary.trim().length > 0 ||
    context.skills.length > 0 ||
    context.experienceHighlights.length > 0
  );
}
