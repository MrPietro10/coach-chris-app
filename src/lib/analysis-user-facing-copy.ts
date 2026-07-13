import type { AnalyzeSelectedJobOutput } from "@/lib/ai/types";

/**
 * Normalize model output so Coach Chris speaks directly to the user.
 * Prompts enforce this first; this is a safety net for stray third-person phrasing.
 */
export function normalizeAnalysisDirectAddress(text: string): string {
  let out = text.trim();
  if (!out) return out;

  const replacements: Array<[RegExp, string]> = [
    [/\bthe candidate's\b/gi, "your"],
    [/\bthe candidate\b/gi, "you"],
    [/\bthe applicant's\b/gi, "your"],
    [/\bthe applicant\b/gi, "you"],
    [/\bhis\/her\b/gi, "your"],
    [/\bhe\/she\b/gi, "you"],
    [/\btheir resume\b/gi, "your resume"],
    [/\bthe resume does(?:n't| not)\b/gi, "your resume does$1"],
    [/\bthe resume shows\b/gi, "your resume shows"],
    [/\bthe resume lacks\b/gi, "your resume lacks"],
    [/\bthe resume includes\b/gi, "your resume includes"],
    [/\bthe resume\b/gi, "your resume"],
  ];

  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }

  return out;
}

function normalizeStringList(items: string[]): string[] {
  return items.map((item) => normalizeAnalysisDirectAddress(item)).filter((item) => item.length > 0);
}

/** Apply direct-address normalization to all user-facing analysis strings. */
export function applyAnalysisUserFacingCopy(
  output: AnalyzeSelectedJobOutput,
): AnalyzeSelectedJobOutput {
  return {
    ...output,
    overallFitSummary: normalizeAnalysisDirectAddress(output.overallFitSummary),
    topStrengths: normalizeStringList(output.topStrengths),
    topGaps: normalizeStringList(output.topGaps),
    riskAreas: normalizeStringList(output.riskAreas),
    highestPriorityImprovement: normalizeAnalysisDirectAddress(output.highestPriorityImprovement),
    missingEvidence: normalizeStringList(output.missingEvidence),
    rubricExplanations: {
      experience: normalizeAnalysisDirectAddress(output.rubricExplanations.experience),
      evidence: normalizeAnalysisDirectAddress(output.rubricExplanations.evidence),
      skills: normalizeAnalysisDirectAddress(output.rubricExplanations.skills),
      domain: normalizeAnalysisDirectAddress(output.rubricExplanations.domain),
      role: normalizeAnalysisDirectAddress(output.rubricExplanations.role),
    },
  };
}
