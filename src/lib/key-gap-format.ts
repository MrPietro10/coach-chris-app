export type StructuredKeyGap = {
  title: string;
  whatThisMeans: string;
  whatToDo: string;
  moreDetail: string | null;
  raw: string;
};

const PRIMARY_DRIVER_PATTERN = /^primary driver(?: to improve)?:\s*/i;

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function shortenText(text: string, maxLen: number): { short: string; truncated: boolean } {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) {
    return { short: normalized, truncated: false };
  }

  const cut = normalized.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const end = lastSpace > maxLen * 0.55 ? lastSpace : maxLen;
  return { short: `${normalized.slice(0, end).trim()}…`, truncated: true };
}

function humanizeGapTitle(requirement: string): string {
  const cleaned = requirement.replace(/\.$/, "").trim();
  if (!cleaned) return "Strengthen this area on your resume";

  if (/^(show|add|highlight|demonstrate|include|clarify|strengthen)/i.test(cleaned)) {
    return capitalizeFirst(cleaned);
  }

  if (cleaned.length <= 64) {
    if (/^(clearer|stronger|more)\s/i.test(cleaned)) {
      return capitalizeFirst(`Show ${cleaned}`);
    }
    if (/(experience|expertise|proof|evidence|metrics|leadership|skills?)/i.test(cleaned)) {
      return capitalizeFirst(`Show stronger ${cleaned.replace(/^clearer\s+/i, "")}`);
    }
    return capitalizeFirst(cleaned);
  }

  const { short } = shortenText(cleaned, 64);
  return short;
}

function extractLabeledSections(text: string): {
  requirement: string;
  resumeShows: string;
  action: string;
} {
  const requirementMatch = text.match(
    /Requirement:\s*([\s\S]+?)(?=Your resume shows:|Strengthen before applying:|$)/i,
  );
  const resumeMatch = text.match(
    /Your resume shows:\s*([\s\S]+?)(?=Strengthen before applying:|$)/i,
  );
  const actionMatch = text.match(/Strengthen before applying:\s*([\s\S]+)$/i);

  return {
    requirement: requirementMatch?.[1]?.trim().replace(/\.$/, "") ?? "",
    resumeShows: resumeMatch?.[1]?.trim().replace(/\.$/, "") ?? "",
    action: actionMatch?.[1]?.trim().replace(/\.$/, "") ?? "",
  };
}

function buildWhatThisMeans(requirement: string, resumeShows: string): string {
  if (resumeShows) {
    const normalized = resumeShows.replace(/^your resume shows\s*/i, "").trim();
    return capitalizeFirst(ensurePeriod(normalized));
  }

  if (requirement) {
    return `This role asks for ${requirement.charAt(0).toLowerCase()}${requirement.slice(1)}.`;
  }

  return "Your resume could show this requirement more clearly for this role.";
}

export function parseKeyGapText(raw: string): StructuredKeyGap {
  const cleanedRaw = raw.trim().replace(PRIMARY_DRIVER_PATTERN, "").trim();
  const { requirement, resumeShows, action } = extractLabeledSections(cleanedRaw);

  if (requirement || resumeShows || action) {
    const title = requirement ? humanizeGapTitle(requirement) : shortenText(cleanedRaw, 64).short;
    const meansFull = buildWhatThisMeans(requirement, resumeShows);
    const { short: whatThisMeans, truncated: meansTruncated } = shortenText(meansFull, 150);
    const whatToDo = action
      ? capitalizeFirst(ensurePeriod(action))
      : "Add one specific resume bullet that shows relevant experience and outcome.";

    const moreDetail =
      meansTruncated || (resumeShows.length > 150 && resumeShows !== whatThisMeans)
        ? resumeShows || cleanedRaw
        : cleanedRaw.length > 220
          ? cleanedRaw
          : null;

    return {
      title,
      whatThisMeans,
      whatToDo,
      moreDetail,
      raw: cleanedRaw,
    };
  }

  const sentences = cleanedRaw.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 3) {
    const whatToDo = capitalizeFirst(ensurePeriod(sentences.slice(2).join(" ")));
    return {
      title: shortenText(sentences[0], 64).short,
      whatThisMeans: shortenText(sentences[1], 150).short,
      whatToDo: shortenText(whatToDo, 160).short,
      moreDetail: cleanedRaw.length > 220 ? cleanedRaw : null,
      raw: cleanedRaw,
    };
  }

  if (sentences.length === 2) {
    return {
      title: shortenText(sentences[0], 64).short,
      whatThisMeans: shortenText(sentences[0], 150).short,
      whatToDo: capitalizeFirst(ensurePeriod(sentences[1])),
      moreDetail: null,
      raw: cleanedRaw,
    };
  }

  return {
    title: shortenText(cleanedRaw, 64).short,
    whatThisMeans: "This is a refinement that can make your fit easier for a recruiter to see.",
    whatToDo: "Add one truthful bullet with context, action, and result.",
    moreDetail: cleanedRaw.length > 64 ? cleanedRaw : null,
    raw: cleanedRaw,
  };
}

export function parseKeyGapList(gaps: string[]): StructuredKeyGap[] {
  return gaps.map(parseKeyGapText);
}
