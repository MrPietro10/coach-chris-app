import type { StoredResumeInput } from "@/lib/resume-store";
import type { TailoredResumeDraftFields } from "@/lib/tailored-resume-draft";

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

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function tokenOverlapRatio(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return left.trim().toLowerCase() === right.trim().toLowerCase() ? 1 : 0;
  }
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function linesAreRelated(left: string, right: string): boolean {
  return tokenOverlapRatio(left, right) >= 0.4;
}

function isSubstantialRevision(source: string, draft: string): boolean {
  const sourceValue = source.trim();
  const draftValue = draft.trim();
  if (!draftValue) return false;
  if (!sourceValue) return true;
  if (draftValue.length >= sourceValue.length * 0.7) return true;
  return tokenOverlapRatio(draftValue, sourceValue) >= 0.35;
}

function mergeSummarySection(source: string, draft: string): string {
  const sourceValue = source.trim();
  const draftValue = draft.trim();
  if (!draftValue) return sourceValue;
  if (!sourceValue) return draftValue;
  if (isSubstantialRevision(sourceValue, draftValue)) return draftValue;
  return sourceValue;
}

function mergeSkillsSection(source: string, draft: string): string {
  const sourceSkills = splitCommaList(source);
  const draftSkills = splitCommaList(draft);
  if (draftSkills.length === 0) return source.trim();
  if (sourceSkills.length === 0) return draft.trim();

  if (
    draftSkills.length >= sourceSkills.length * 0.85 ||
    draftSkills.filter((skill) => sourceSkills.some((item) => linesAreRelated(item, skill))).length /
      sourceSkills.length >=
      0.85
  ) {
    return draft.trim();
  }

  const merged = [...draftSkills];
  for (const skill of sourceSkills) {
    if (!merged.some((item) => linesAreRelated(item, skill))) {
      merged.push(skill);
    }
  }
  return merged.join(", ");
}

function mergeLineSection(source: string, draft: string): string {
  const sourceLines = splitLineList(source);
  const draftLines = splitLineList(draft);
  if (draftLines.length === 0) return source.trim();
  if (sourceLines.length === 0) return draft.trim();

  if (
    draftLines.length >= sourceLines.length * 0.85 ||
    draftLines.filter((line) => sourceLines.some((item) => linesAreRelated(item, line))).length /
      sourceLines.length >=
      0.85
  ) {
    return draft.trim();
  }

  const usedDraftIndices = new Set<number>();
  const merged: string[] = [];

  for (const sourceLine of sourceLines) {
    const matchIndex = draftLines.findIndex(
      (draftLine, index) => !usedDraftIndices.has(index) && linesAreRelated(sourceLine, draftLine),
    );
    if (matchIndex >= 0) {
      usedDraftIndices.add(matchIndex);
      merged.push(draftLines[matchIndex]);
      continue;
    }
    merged.push(sourceLine);
  }

  for (let index = 0; index < draftLines.length; index += 1) {
    if (usedDraftIndices.has(index)) continue;
    const draftLine = draftLines[index];
    const alreadyRepresented = sourceLines.some((sourceLine) => linesAreRelated(sourceLine, draftLine));
    if (!alreadyRepresented) {
      merged.push(draftLine);
    }
  }

  return merged.join("\n");
}

/** Merge tailored draft fields into a source resume, preserving untouched source content. */
export function mergeTailoredFieldsWithSource(
  source: StoredResumeInput,
  draft: TailoredResumeDraftFields | StoredResumeInput,
): StoredResumeInput {
  const optionalDraftFields: Partial<StoredResumeInput> =
    "rawText" in draft ||
    "candidateName" in draft ||
    "contactLine" in draft ||
    "extraSections" in draft
      ? draft
      : {};
  return {
    rawText: optionalDraftFields.rawText ?? source.rawText,
    candidateName: optionalDraftFields.candidateName ?? source.candidateName,
    contactLine: optionalDraftFields.contactLine ?? source.contactLine,
    extraSections: optionalDraftFields.extraSections ?? source.extraSections ?? [],
    summary: mergeSummarySection(source.summary, draft.summary),
    skills: mergeSkillsSection(source.skills, draft.skills),
    highlights: mergeLineSection(source.highlights, draft.highlights),
    education: mergeLineSection(source.education, draft.education),
  };
}

export function storedInputToDraftFields(input: StoredResumeInput): TailoredResumeDraftFields {
  return {
    summary: input.summary,
    skills: input.skills,
    highlights: input.highlights,
    education: input.education,
  };
}
