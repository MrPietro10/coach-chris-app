export type JobDescriptionSectionKey =
  | "overview"
  | "responsibilities"
  | "requirements"
  | "qualifications"
  | "preferred_qualifications"
  | "nice_to_have";

export type JobDescriptionSection = {
  key: JobDescriptionSectionKey;
  label: string;
  content: string;
};

type SectionRule = {
  key: JobDescriptionSectionKey;
  label: string;
  patterns: RegExp[];
};

const SECTION_RULES: SectionRule[] = [
  {
    key: "responsibilities",
    label: "Responsibilities",
    patterns: [
      /^responsibilities\b/i,
      /^what you(?:'ll| will) do\b/i,
      /^what you(?:'ll| will) be doing\b/i,
      /^the role\b/i,
      /^role overview\b/i,
      /^key responsibilities\b/i,
    ],
  },
  {
    key: "requirements",
    label: "Requirements",
    patterns: [
      /^requirements\b/i,
      /^basic qualifications\b/i,
      /^minimum qualifications\b/i,
      /^minimum requirements\b/i,
      /^what you(?:'ll| will) need\b/i,
      /^what we(?:'re| are) looking for\b/i,
    ],
  },
  {
    key: "qualifications",
    label: "Qualifications",
    patterns: [
      /^qualifications\b/i,
      /^required qualifications\b/i,
      /^required skills\b/i,
      /^must have\b/i,
    ],
  },
  {
    key: "preferred_qualifications",
    label: "Preferred qualifications",
    patterns: [
      /^preferred qualifications\b/i,
      /^preferred skills\b/i,
      /^preferred experience\b/i,
      /^desired qualifications\b/i,
    ],
  },
  {
    key: "nice_to_have",
    label: "Nice to haves",
    patterns: [
      /^nice to have\b/i,
      /^nice-to-have\b/i,
      /^bonus\b/i,
      /^pluses?\b/i,
      /^preferred but not required\b/i,
    ],
  },
];

export function matchSectionHeader(line: string): SectionRule | null {
  const trimmed = line.trim().replace(/[:#*_\-\s]+$/g, "").trim();
  if (trimmed.length < 3 || trimmed.length > 80) {
    return null;
  }
  for (const rule of SECTION_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return rule;
    }
  }
  return null;
}

export function splitTextIntoSections(text: string): JobDescriptionSection[] {
  const lines = text.split("\n");
  const sections: JobDescriptionSection[] = [];
  let current: JobDescriptionSection | null = null;
  const preamble: string[] = [];

  function flushCurrent(): void {
    if (!current) return;
    current.content = current.content.trim();
    if (current.content.length > 0) {
      sections.push(current);
    }
    current = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const matched = trimmed ? matchSectionHeader(trimmed) : null;

    if (matched) {
      flushCurrent();
      current = {
        key: matched.key,
        label: matched.label,
        content: "",
      };
      continue;
    }

    if (current) {
      current.content += (current.content ? "\n" : "") + line;
    } else if (trimmed) {
      preamble.push(line);
    } else if (preamble.length > 0) {
      preamble.push("");
    }
  }

  flushCurrent();

  const overviewText = preamble.join("\n").trim();
  if (overviewText.length > 0) {
    sections.unshift({
      key: "overview",
      label: "Overview",
      content: overviewText,
    });
  }

  return sections;
}

export function formatSectionsForAnalysis(sections: JobDescriptionSection[]): string {
  if (sections.length === 0) return "";

  return sections
    .map((section) => {
      const body = section.content.trim();
      if (!body) return "";
      return `${section.label}\n\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function countMeaningfulSections(sections: JobDescriptionSection[]): number {
  return sections.filter(
    (section) =>
      section.key !== "overview" && section.content.trim().length >= 40,
  ).length;
}
