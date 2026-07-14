import type { AnalysisResumeContext } from "@/lib/analysis-resume-context";

export type JobRequirements = {
  hard: string[];
  soft: string[];
  fingerprint: string;
  extractor: "heuristic-v1";
};

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function buildJobRequirementsFingerprint(jobDescription: string): string {
  return hashString(jobDescription.trim());
}

function normalizeLine(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/^[•*\-–—]\s+/, "")
    .trim();
}

function splitToCandidateLines(description: string): string[] {
  const normalized = description
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const rawLines = normalized.split("\n");
  const out: string[] = [];
  for (const raw of rawLines) {
    const line = normalizeLine(raw);
    if (!line) continue;
    out.push(line);
  }
  return out;
}

function looksRequirementLike(line: string): boolean {
  if (line.length < 8) return false;
  if (line.length > 220) return false;
  return (
    /\b(must|required|need to|you will|you'll|responsibilit|qualificat|experience with|proficient|expertise)\b/i.test(
      line,
    ) || /(\d+\+?\s+years|\byears\b)/i.test(line)
  );
}

function isSoftSignal(line: string): boolean {
  return /\b(preferred|nice to have|bonus|a plus|ideally|familiarity with)\b/i.test(line);
}

function isHardSignal(line: string): boolean {
  return /\b(must|required|need to|required skills|minimum|you will|responsibilit)\b/i.test(line);
}

function cleanRequirements(items: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function extractJobRequirements(description: string): JobRequirements {
  const fingerprint = buildJobRequirementsFingerprint(description);
  const lines = splitToCandidateLines(description);

  const hard: string[] = [];
  const soft: string[] = [];

  for (const line of lines) {
    if (!looksRequirementLike(line)) continue;
    if (isSoftSignal(line) && !isHardSignal(line)) {
      soft.push(line);
    } else {
      hard.push(line);
    }
  }

  return {
    hard: cleanRequirements(hard, 16),
    soft: cleanRequirements(soft, 12),
    fingerprint,
    extractor: "heuristic-v1",
  };
}

function normalizeTextForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resumeToSearchText(resume: AnalysisResumeContext): string {
  const blocks = [
    resume.summary,
    resume.skills.join(", "),
    resume.experienceHighlights.join("\n"),
    resume.educationEntries.join("\n"),
  ];
  return normalizeTextForMatching(blocks.join("\n"));
}

function requirementToKeywords(requirement: string): string[] {
  const normalized = normalizeTextForMatching(requirement);
  const tokens = normalized
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
  // Keep only meaningful tokens; strip generic filler.
  const stop = new Set([
    "and",
    "or",
    "the",
    "a",
    "an",
    "to",
    "of",
    "in",
    "for",
    "with",
    "on",
    "you",
    "your",
    "will",
    "must",
    "required",
    "preferred",
    "experience",
    "skills",
    "ability",
  ]);
  return tokens.filter((t) => t.length >= 3 && !stop.has(t)).slice(0, 8);
}

function isRequirementMet(requirement: string, resumeText: string): boolean {
  const keywords = requirementToKeywords(requirement);
  if (keywords.length === 0) return false;
  const hits = keywords.filter((k) => resumeText.includes(k)).length;
  // Require some overlap but not all keywords (job text can be verbose).
  return hits >= Math.min(2, keywords.length);
}

export function computeDeterministicGaps(options: {
  requirements: JobRequirements;
  resumeContext: AnalysisResumeContext;
  maxGaps?: number;
}): { gaps: string[]; unmetHard: string[]; unmetSoft: string[] } {
  const resumeText = resumeToSearchText(options.resumeContext);
  const unmetHard = options.requirements.hard.filter((req) => !isRequirementMet(req, resumeText));
  const unmetSoft = options.requirements.soft.filter((req) => !isRequirementMet(req, resumeText));

  const maxGaps = options.maxGaps ?? 4;
  const gaps = [...unmetHard, ...unmetSoft].slice(0, maxGaps).map((req) => {
    // Keep the gap phrasing constructive and resume-focused.
    return `Requirement: ${req.replace(/\.$/, "")}. Strengthen before applying: add one truthful bullet or keyword that proves this.`.trim();
  });

  return { gaps, unmetHard, unmetSoft };
}

