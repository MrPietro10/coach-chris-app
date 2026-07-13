/** Prompt and post-processing guardrails for tailored resume drafting. */

export const TAILORED_RESUME_STYLE_RULES = [
  "Tailor like a strong career coach: specific, concise, truthful, and recruiter-friendly.",
  "Improve the existing resume by sharpening bullets, adding relevant keywords, emphasizing fit, and preserving truthfulness.",
  "Keep resume bullets concise—ideally 1–2 lines each—and easy to skim in 6–10 seconds.",
  "Do not over-explain. Prefer strong evidence over long explanation.",
  "Never turn resume bullets into paragraphs. Leave deeper context for interviews unless essential for credibility.",
  "Prioritize recruiter skim-readability: lead with role-relevant keywords, scope, and outcome.",
  "Keep formatting readable: one idea per bullet, parallel structure, no wall-of-text blocks.",
  "When evidence is missing, do not force a long fabricated bullet into the resume body.",
  "Use notes[] with: If true, add a concise bullet like: [short example].",
  "Do not create bullets with fake metrics, fake employers, or fake achievements.",
] as const;

export const TAILORED_RESUME_TECHNICAL_GAP_GUIDANCE = [
  "For technical/product gaps, distinguish what the resume actually shows:",
  "- Tool familiarity (listed or mentioned once)",
  "- Project use (built/prototyped in a defined context)",
  "- Production deployment (live users, shipped system, maintained in production)",
  "- Team collaboration (cross-functional partners, stakeholders)",
  "- Measurable impact (time saved, revenue, adoption, quality)",
  "Strengthen the highest level of evidence the resume truthfully supports—never upgrade familiarity to production deployment without proof.",
  "If only familiarity exists, sharpen wording and keywords; do not invent shipped systems or metrics.",
] as const;

export const TAILORED_RESUME_CONCISE_EXAMPLES = [
  'GOOD summary: "Product manager with 5 years in B2B SaaS. Shipped onboarding flows used by 40k monthly active users."',
  'BAD summary: "Dynamic, results-driven professional with extensive experience leveraging cross-functional synergies to drive transformative outcomes across multiple verticals..."',
  'GOOD bullet: "Built n8n automations that cut weekly reporting from 4 hours to 45 minutes for a 6-person ops team."',
  'BAD bullet: "Leveraged cutting-edge automation tooling including n8n and various AI assistants to comprehensively transform legacy reporting workflows through a multi-phase initiative spanning several quarters..."',
  'GOOD missing-evidence note: "If true, add a concise bullet like: Prototyped a customer-facing AI workflow in Lovable for pilot users, reducing manual triage steps."',
  'BAD missing-evidence note: "You should definitely add a very detailed paragraph explaining every aspect of your AI experience including all tools, stakeholders, timelines, and outcomes."',
] as const;

export const TAILORED_RESUME_EDITOR_CHECKLIST = [
  "Is this concise?",
  "Is this truthful?",
  "Is this skimmable?",
  "Does this preserve original resume content?",
  "Does this avoid overstuffing?",
] as const;

export const TAILORED_RESUME_MAX_BULLET_CHARS = 280;
export const TAILORED_RESUME_MAX_SUMMARY_CHARS = 520;
export const TAILORED_RESUME_MAX_SKILL_ITEMS = 18;

export function buildTailoredResumeMissingEvidenceNote(gapLine: string): string | null {
  const cleaned = gapLine.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const shortenedGap =
    cleaned.length > 90 ? `${cleaned.slice(0, 87).trim()}…` : cleaned;

  return `If true, add a concise bullet like: "[Action] using [tool/context] for [audience], [real outcome if known] — e.g. related to ${shortenedGap}.`;
}

export function shortenResumeBullet(
  bullet: string,
  maxChars = TAILORED_RESUME_MAX_BULLET_CHARS,
): string {
  const trimmed = bullet.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;

  const sentences = trimmed.match(/[^.!?]+[.!?]+/g) ?? [];
  if (sentences.length >= 2) {
    const twoSentence = sentences.slice(0, 2).join("").trim();
    if (twoSentence.length <= maxChars) return twoSentence;
  }

  if (sentences.length === 1 && sentences[0].length <= maxChars) {
    return sentences[0].trim();
  }

  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const end = lastSpace > maxChars * 0.55 ? lastSpace : maxChars;
  return `${trimmed.slice(0, end).trim()}…`;
}

export function shortenResumeSummary(
  summary: string,
  maxChars = TAILORED_RESUME_MAX_SUMMARY_CHARS,
): string {
  const trimmed = summary.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;

  const sentences = trimmed.match(/[^.!?]+[.!?]+/g) ?? [];
  let built = "";
  for (const sentence of sentences) {
    const next = `${built}${sentence}`.trim();
    if (next.length > maxChars) break;
    built = next;
  }
  if (built.length > 0) return built;

  return shortenResumeBullet(trimmed, maxChars);
}

export function enforceTailoredResumeBrevity(output: {
  summary: string;
  skills: string[];
  experience: string[];
  education: string[];
}): {
  summary: string;
  skills: string[];
  experience: string[];
  education: string[];
} {
  return {
    summary: shortenResumeSummary(output.summary),
    skills: output.skills
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0)
      .slice(0, TAILORED_RESUME_MAX_SKILL_ITEMS),
    experience: output.experience.map((bullet) => shortenResumeBullet(bullet)),
    education: output.education.map((entry) => shortenResumeBullet(entry, 220)),
  };
}

export function buildTailoredResumePromptGuardrails(): string {
  return [
    "RESUME TAILORING STYLE:",
    ...TAILORED_RESUME_STYLE_RULES.map((line) => `- ${line}`),
    "",
    "TECHNICAL / PRODUCT GAP HANDLING:",
    ...TAILORED_RESUME_TECHNICAL_GAP_GUIDANCE.map((line) => `- ${line}`),
    "",
    "CONCISE EXAMPLES:",
    ...TAILORED_RESUME_CONCISE_EXAMPLES.map((line) => `- ${line}`),
    "",
    "Before returning JSON, run this internal resume editor checklist:",
    ...TAILORED_RESUME_EDITOR_CHECKLIST.map((line) => `- ${line}`),
    "If any answer is no, revise the draft to be shorter, more truthful, or less stuffed before responding.",
  ].join("\n");
}
