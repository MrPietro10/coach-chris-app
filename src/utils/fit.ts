import type {
  ConfidenceLevel,
  FitCategory,
  FitBand,
  FitCategoryMeta,
  FitEvaluation,
  FitEvaluationInput,
  FitSignal,
} from "@/types/coach";

export const FIT_CATEGORIES: FitCategory[] = [
  "No Fit",
  "Aspirational Fit",
  "Backup Fit",
  "Strong Fit",
];

export const FIT_CATEGORY_META: Record<FitCategory, FitCategoryMeta> = {
  "No Fit": {
    label: "No Fit",
    shortLabel: "No Fit",
    description: "No relevant experience and no stated preference match.",
  },
  "Aspirational Fit": {
    label: "Aspirational Fit",
    shortLabel: "Aspirational",
    description: "Preference match exists, but relevant experience is not yet clear.",
  },
  "Backup Fit": {
    label: "Backup Fit",
    shortLabel: "Backup",
    description: "Relevant experience exists, but preference alignment is weaker.",
  },
  "Strong Fit": {
    label: "Strong Fit",
    shortLabel: "Strong",
    description: "Relevant experience and clear preference alignment are both present.",
  },
};

export function resolveFitCategory(signal: FitSignal): FitCategory {
  if (!signal.hasExperience && !signal.hasPreference) return "No Fit";
  if (!signal.hasExperience && signal.hasPreference) return "Aspirational Fit";
  if (signal.hasExperience && !signal.hasPreference) return "Backup Fit";
  return "Strong Fit";
}

export function evaluateMockFit(input: FitEvaluationInput): FitEvaluation {
  return {
    category: resolveFitCategory(input),
    score: input.score,
    reasoning: input.reasoning,
  };
}

export function scoreFit(signal: FitSignal): FitCategory {
  return resolveFitCategory(signal);
}

export function getFitMeta(fit: FitCategory): FitCategoryMeta {
  return FIT_CATEGORY_META[fit];
}

export function fitVerdict(fit: FitCategory): string {
  switch (fit) {
    case "Strong Fit":
      return "You should apply";
    case "Backup Fit":
      return "Safe option — apply";
    case "Aspirational Fit":
      return "Stretch role — apply selectively";
    case "No Fit":
      return "Not recommended";
  }
}

export function fitColor(fit: FitCategory): string {
  switch (fit) {
    case "No Fit":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Aspirational Fit":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Backup Fit":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Strong Fit":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
}

export function getFitBand(score: number): FitBand {
  if (score <= 39) return "Low";
  if (score <= 69) return "Medium";
  return "High";
}

export function inferConfidenceLevel(input: {
  resumeCompleteness: number;
  missingEvidenceCount: number;
  keyRequirementEvidenceCount: number;
  evidenceItems?: string[];
}): ConfidenceLevel {
  const {
    resumeCompleteness,
    missingEvidenceCount,
    keyRequirementEvidenceCount,
    evidenceItems = [],
  } = input;
  const concreteEvidenceCount = evidenceItems.filter((item) =>
    /\d/.test(item) ||
    /(increased|reduced|improved|launched|delivered|impact|outcome|result)/i.test(item),
  ).length;

  // Coverage: are key requirements addressed and not blocked by large missing evidence?
  const hasStrongCoverage = keyRequirementEvidenceCount >= 3 && missingEvidenceCount <= 1;
  const hasPartialCoverage = keyRequirementEvidenceCount >= 2 && missingEvidenceCount <= 2;

  // Quality: do we have concrete examples/outcomes instead of only generic claims?
  const hasStrongQuality = concreteEvidenceCount >= 2;
  const hasSomeQuality = concreteEvidenceCount >= 1;

  // Clarity: is the resume context specific enough to support reliable matching?
  const hasClearClarity = resumeCompleteness >= 0.75;
  const hasSomeClarity = resumeCompleteness >= 0.55;

  if (hasStrongCoverage && hasStrongQuality && hasClearClarity) return "High";

  if (
    keyRequirementEvidenceCount <= 1 ||
    missingEvidenceCount >= 3 ||
    !hasSomeClarity ||
    (!hasSomeQuality && !hasPartialCoverage)
  ) {
    return "Low";
  }

  return "Medium";
}
