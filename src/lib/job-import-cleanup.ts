const NOISE_LINE_PATTERNS: RegExp[] = [
  /^skip to (main )?content/i,
  /^cookie/i,
  /^privacy (policy|notice)/i,
  /^terms (of use|and conditions)/i,
  /^sign in$/i,
  /^log in$/i,
  /^apply now$/i,
  /^share (this )?job/i,
  /^save job$/i,
  /^report job$/i,
  /^©\s*\d{4}/i,
  /^all rights reserved/i,
  /^equal opportunity/i,
  /^accommodation(s)? request/i,
  /^follow us/i,
  /^connect with us/i,
];

/**
 * Normalize imported job description text for review and analysis.
 */
export function cleanupImportedJobDescription(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");

  text = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/,([A-Za-z])/g, ", $1")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");

  const lines = text.split("\n").map((line) => line.replace(/[ \t]{2,}/g, " ").trim());

  const filtered: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (filtered.length > 0 && filtered[filtered.length - 1] !== "") {
        filtered.push("");
      }
      continue;
    }
    if (line.length < 4 && !/[a-z]{2,}/i.test(line)) {
      continue;
    }
    if (NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      continue;
    }
    if (/^(home|about|careers|jobs|contact)$/i.test(line)) {
      continue;
    }
    filtered.push(line);
  }

  return filtered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseSuggestedJobTitle(raw: string | null): { title: string; company: string } {
  if (!raw?.trim()) {
    return { title: "", company: "" };
  }
  const trimmed = raw.trim();
  const atMatch = trimmed.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() };
  }
  const dashParts = trimmed.split(/\s[-–|•]\s+/);
  if (dashParts.length >= 2) {
    return {
      title: dashParts[0].trim(),
      company: dashParts.slice(1).join(" - ").trim(),
    };
  }
  return { title: trimmed, company: "" };
}
