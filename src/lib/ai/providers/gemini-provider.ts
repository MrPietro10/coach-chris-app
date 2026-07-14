import { GoogleGenAI } from "@google/genai";
import { applyAnalysisUserFacingCopy } from "@/lib/analysis-user-facing-copy";
import {
  buildTailoredResumeMissingEvidenceNote,
  buildTailoredResumePromptGuardrails,
  enforceTailoredResumeBrevity,
} from "@/lib/tailored-resume-guardrails";
import type {
  AIProvider,
  AnalyzeJobFitInput,
  AnalyzeJobFitOutput,
  AnalyzeSelectedJobInput,
  AnalyzeSelectedJobOutput,
  GenerateCoachReplyInput,
  GenerateCoachReplyOutput,
  GenerateInterviewQuestionInput,
  GenerateInterviewQuestionOutput,
  GenerateTailoredResumeDraftInput,
  GenerateTailoredResumeDraftOutput,
  OptimizeResumeInput,
  OptimizeResumeOutput,
} from "@/lib/ai/types";

function estimateFitScore(input: AnalyzeJobFitInput): number {
  const normalizedSkills = input.requiredSkills.map((skill) => skill.toLowerCase());
  const summary = input.resumeSummary.toLowerCase();
  const hits = normalizedSkills.filter((skill) => summary.includes(skill.toLowerCase())).length;
  const ratio = normalizedSkills.length > 0 ? hits / normalizedSkills.length : 0.5;
  return Math.max(30, Math.min(92, Math.round(45 + ratio * 45)));
}

function fitLabelFromScore(score: number): AnalyzeJobFitOutput["fitLabel"] {
  if (score >= 80) return "Strong Fit";
  if (score >= 65) return "Backup Fit";
  if (score >= 45) return "Aspirational Fit";
  return "Low Fit";
}

function extractJsonObject(raw: string): string {
  const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? raw.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    return candidate;
  }
  return candidate.slice(start, end + 1);
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanList(items: string[], maxItems: number, blocked = new Set<string>()): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normalizeKey(trimmed);
    if (!key || seen.has(key) || blocked.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

function getRuntimeDateContext(): { isoDate: string; localeDate: string } {
  const now = new Date();
  return {
    isoDate: now.toISOString().slice(0, 10),
    localeDate: now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
  };
}

function collectAnalysisKeywords(input: GenerateTailoredResumeDraftInput): Set<string> {
  const text = [
    ...input.analysisContext.topGaps,
    ...input.analysisContext.riskAreas,
    input.analysisContext.highestPriorityImprovement,
    ...input.analysisContext.missingEvidence,
  ].join(" ");
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
  return new Set(tokens);
}

function noteOverlapsAnalysis(note: string, keywords: Set<string>): boolean {
  const normalized = note.toLowerCase();
  for (const keyword of keywords) {
    if (normalized.includes(keyword)) return true;
  }
  return false;
}

function buildTemplateNote(gapLine: string): string | null {
  return buildTailoredResumeMissingEvidenceNote(gapLine);
}

function ensureActionableNextStep(step: string, fallback: string): string {
  const trimmed = step.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  const startsWithAction = /^(add|update|rewrite|replace|quantify|tailor|remove|clarify|prove)\b/.test(lower);
  return startsWithAction ? trimmed : fallback;
}

/** Input/schema gaps only — not analytical resume-vs-job gap statements. */
function isMissingInputEvidenceLine(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return (
    /^resume summary is missing\.?$/.test(normalized) ||
    /^resume skills are missing\.?$/.test(normalized) ||
    /^resume experience section is missing\.?$/.test(normalized) ||
    /^selected job required skills are missing\.?$/.test(normalized) ||
    /^selected job description is missing\.?$/.test(normalized) ||
    normalized.includes("gemini_api_key") ||
    normalized.includes("gemini is not configured") ||
    normalized.includes("cannot run single-job analysis")
  );
}

const RUBRIC_WEIGHTS = {
  experience: 0.4,
  evidence: 0.25,
  skills: 0.15,
  domain: 0.1,
  role: 0.1,
} as const;

function clampScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeRubricFitScore(scores: {
  experience: number;
  evidence: number;
  skills: number;
  domain: number;
  role: number;
}): number {
  const weighted =
    scores.experience * RUBRIC_WEIGHTS.experience +
    scores.evidence * RUBRIC_WEIGHTS.evidence +
    scores.skills * RUBRIC_WEIGHTS.skills +
    scores.domain * RUBRIC_WEIGHTS.domain +
    scores.role * RUBRIC_WEIGHTS.role;
  return Math.max(1, Math.min(99, Math.round(weighted)));
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly name = "Gemini";

  async analyzeJobFit(input: AnalyzeJobFitInput): Promise<AnalyzeJobFitOutput> {
    const score = estimateFitScore(input);
    const topSkills = input.requiredSkills.slice(0, 3);
    return {
      provider: this.id,
      score,
      fitLabel: fitLabelFromScore(score),
      strengths: [
        `Your summary aligns with ${topSkills[0] ?? "core role requirements"}.`,
        `Your targeting is relevant to ${input.jobTitle} at ${input.company}.`,
      ],
      gaps: [
        "Requirement: clearer impact proof. Your resume shows relevant experience but limited quantified outcomes. Strengthen before applying: add one truthful metric to a key bullet.",
        "Requirement: role-specific framing. Your resume shows transferable skills but not enough direct alignment with the top priority. Strengthen before applying: tailor one summary line to this role.",
      ],
      reasoning:
        "Mock Gemini analysis combines lightweight keyword overlap with coaching heuristics.",
    };
  }

  async optimizeResume(input: OptimizeResumeInput): Promise<OptimizeResumeOutput> {
    return {
      provider: this.id,
      optimizedSummary: `${input.currentSummary} Focus this summary more explicitly on ${input.targetRole}.`,
      optimizedBullets: input.bullets.map((bullet) => `${bullet} (add one measurable outcome)`),
      notes: [
        "Mock-only optimization output for architecture validation.",
        "Preserve truthful claims and add metrics only when verified.",
      ],
    };
  }

  async generateTailoredResumeDraft(
    input: GenerateTailoredResumeDraftInput,
  ): Promise<GenerateTailoredResumeDraftOutput> {
    const runtimeDate = getRuntimeDateContext();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_real_key_here") {
      return {
        provider: this.id,
        summary: input.resumeContext.summary.trim(),
        skills: [...input.resumeContext.skills],
        experience: [...input.resumeContext.experienceHighlights],
        education: [...input.resumeContext.educationEntries],
        notes: [
          "Live tailored drafting requires a valid GEMINI_API_KEY on the server.",
          `Priority for ${input.selectedJob.title}: ${input.analysisContext.highestPriorityImprovement}`,
        ],
      };
    }

    const behavior = input.behaviorContext;
    const tailoringGuardrails = buildTailoredResumePromptGuardrails();
    const systemPolicy = [
      "You are Coach Chris drafting a job-specific resume version.",
      `Current date (UTC): ${runtimeDate.isoDate} (${runtimeDate.localeDate}).`,
      "CRITICAL RULES:",
      "- Start from the provided source resume as your base document; improve it rather than rewriting from scratch.",
      "- Use ONLY evidence already present in the provided resume context.",
      "- Do NOT fabricate employers, titles, dates, metrics, certifications, languages, or skills.",
      "- You may reword, reorder, shorten, and emphasize existing truthful content for the target job.",
      "- Keep all four sections (summary, skills, experience, education). Never return an empty section unless the source section is empty.",
      "- Do NOT add new skills unless they are clearly implied by existing experience text.",
      "- If a gap cannot be addressed with existing evidence, add a note in notes[] only — not in resume body — in this format: 'If true, add a concise bullet like: [short example]'.",
      "- Never use placeholder metrics like 'increased X by Y%' unless that metric exists in source material.",
      "- Dates earlier than the current date are not future dates.",
      "- Future education dates are valid when clearly labeled expected/anticipated.",
      "- Do not ask the user to confirm facts that are already clearly stated in the resume context.",
      "- Use second-person language only: you, your resume, your experience.",
      tailoringGuardrails,
      behavior
        ? [
            "Identity:",
            ...behavior.policy.identity.map((line) => `- ${line}`),
            "Core Rules:",
            ...behavior.policy.coreRules.map((line) => `- ${line}`),
            "Mode Guidelines:",
            ...behavior.policy.modeGuidelines[behavior.mode].map((line) => `- ${line}`),
          ].join("\n")
        : "",
      "Return valid JSON only with keys: summary (string), skills (string[]), experience (string[]), education (string[]), notes (string[] up to 5).",
      "summary: 2–4 short sentences max; lead with role fit, not buzzwords.",
      "experience: one concise bullet per item (ideally 1–2 lines, max ~280 characters each).",
      "education: one short line per entry.",
      "skills: relevant keywords only; do not dump every possible tool.",
      "Coach notes must be based only on topGaps, highestPriorityImprovement, missingEvidence, riskAreas, and behavior guidance from the context.",
      "Prioritize examples from work experience first, projects/startups second, MBA/coursework third.",
    ]
      .filter(Boolean)
      .join("\n");

    const context = {
      selectedJob: {
        title: input.selectedJob.title,
        company: input.selectedJob.company,
        location: input.selectedJob.location,
        description: input.selectedJob.description,
        requiredSkills: input.selectedJob.requiredSkills,
      },
      sourceResume: input.sourceResume,
      resumeContext: input.resumeContext,
      analysisContext: input.analysisContext,
      behaviorGuidance: behavior?.guidance ?? [],
      currentDate: runtimeDate.isoDate,
      technicalEvidenceHints: [
        "Skills",
        "Tools and Technologies",
        "Tech and AI",
        "AI tools",
        "Cursor",
        "Claude",
        "Gemini",
        "n8n",
        "Lovable",
        "technical collaboration",
        "systems/process work",
      ],
    };

    const userPrompt = [
      "Draft a tailored resume for the selected job using ONLY the resume evidence provided.",
      "Sharpen existing bullets, add relevant keywords, and emphasize fit—do not over-explain or overstuff.",
      "Keep every bullet concise and skimmable (1–2 lines). Leave interview-level detail for notes, not resume body.",
      "Align summary and bullets to the job and analysis gaps without inventing facts.",
      "Put missing-evidence prompts in notes[] as: If true, add a concise bullet like: [short example].",
      "Run the internal resume editor checklist before responding.",
      "",
      `Context JSON:\n${JSON.stringify(context, null, 2)}`,
    ].join("\n");

    const client = new GoogleGenAI({ apiKey });
    let raw = "";
    try {
      const response = await client.models.generateContent({
        model: "models/gemini-2.5-flash",
        contents: `${systemPolicy}\n\n${userPrompt}`,
        config: { temperature: 0 },
      });
      raw = typeof response.text === "string" ? response.text : "";
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }

    const jsonText = extractJsonObject(raw);
    let parsed: Partial<GenerateTailoredResumeDraftOutput>;
    try {
      parsed = JSON.parse(jsonText) as Partial<GenerateTailoredResumeDraftOutput>;
    } catch {
      throw new Error("Gemini returned invalid JSON for tailored resume draft.");
    }

    const skills = Array.isArray(parsed.skills)
      ? parsed.skills.filter((item): item is string => typeof item === "string").map((item) => item.trim())
      : input.resumeContext.skills;
    const experience = Array.isArray(parsed.experience)
      ? parsed.experience
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : input.resumeContext.experienceHighlights;
    const education = Array.isArray(parsed.education)
      ? parsed.education
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : input.resumeContext.educationEntries;
    const analysisKeywords = collectAnalysisKeywords(input);
    const modelNotes = Array.isArray(parsed.notes)
      ? cleanList(
          parsed.notes.filter((item): item is string => typeof item === "string"),
          5,
        )
      : [];
    const filteredModelNotes = modelNotes.filter((note) => noteOverlapsAnalysis(note, analysisKeywords));
    const templateNotes = input.analysisContext.missingEvidence
      .map((line) => buildTemplateNote(line))
      .filter((line): line is string => Boolean(line))
      .slice(0, 2);
    const notes = cleanList(
      [
        ...filteredModelNotes,
        `Top priority next step: ${input.analysisContext.highestPriorityImprovement}`,
        ...templateNotes,
      ],
      5,
    );

    const brevityAdjusted = enforceTailoredResumeBrevity({
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : input.resumeContext.summary.trim(),
      skills: skills.length > 0 ? skills : input.resumeContext.skills,
      experience: experience.length > 0 ? experience : input.resumeContext.experienceHighlights,
      education: education.length > 0 ? education : input.resumeContext.educationEntries,
    });

    return {
      provider: this.id,
      summary: brevityAdjusted.summary,
      skills: brevityAdjusted.skills,
      experience: brevityAdjusted.experience,
      education: brevityAdjusted.education,
      notes,
    };
  }

  async generateCoachReply(input: GenerateCoachReplyInput): Promise<GenerateCoachReplyOutput> {
    const runtimeDate = getRuntimeDateContext();
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("[GeminiProvider] GEMINI_API_KEY present:", Boolean(apiKey && apiKey !== "your_real_key_here"));
    if (!apiKey || apiKey === "your_real_key_here") {
      return {
        provider: this.id,
        reply:
          "I can help with that. Add a valid GEMINI_API_KEY in your server environment to enable live responses.",
        followUps: [],
      };
    }

    const behavior = input.behaviorContext;
    const systemPolicy = behavior
      ? [
          "You are Coach Chris.",
          `Current date (UTC): ${runtimeDate.isoDate} (${runtimeDate.localeDate}).`,
          "Identity:",
          ...behavior.policy.identity.map((line) => `- ${line}`),
          "Core Rules:",
          ...behavior.policy.coreRules.map((line) => `- ${line}`),
          "Tone:",
          ...behavior.policy.tone.map((line) => `- ${line}`),
          "Mode Guidelines:",
          ...behavior.policy.modeGuidelines[behavior.mode].map((line) => `- ${line}`),
          "When discussing timelines, treat dates earlier than the current date as past dates.",
          "Treat expected graduation dates as valid when the resume explicitly labels them expected/anticipated.",
          "Do not ask users to confirm facts already clearly present in provided context.",
        ].join("\n")
      : `You are Coach Chris. Current date (UTC): ${runtimeDate.isoDate}. Be concise, practical, honest, and never invent experience or metrics.`;

    const contextLines: string[] = [];
    if (input.pageContext) contextLines.push(`Page Context: ${input.pageContext}`);
    if (input.selectedJobContext) {
      contextLines.push(
        `Selected Job: ${input.selectedJobContext.title} at ${input.selectedJobContext.company} (${input.selectedJobContext.status ?? "unknown status"})`,
      );
    }
    if (input.fitContext) {
      contextLines.push(`Fit Snapshot: ${input.fitContext.fit} (${input.fitContext.score}/100)`);
      if (input.fitContext.topStrengths.length > 0) {
        contextLines.push(`Top Strengths: ${input.fitContext.topStrengths.join("; ")}`);
      }
      if (input.fitContext.topGaps.length > 0) {
        contextLines.push(`Top Gaps: ${input.fitContext.topGaps.join("; ")}`);
      }
    }
    if (input.optimizeContext) {
      contextLines.push(
        `Optimize Target: ${input.optimizeContext.targetRole} at ${input.optimizeContext.targetCompany}`,
      );
      if (input.optimizeContext.keyChanges.length > 0) {
        contextLines.push(`Key Changes: ${input.optimizeContext.keyChanges.join("; ")}`);
      }
      if (input.optimizeContext.metricPrompts.length > 0) {
        contextLines.push(`Metric Prompts: ${input.optimizeContext.metricPrompts.join("; ")}`);
      }
    }
    if (behavior?.guidance?.length) {
      contextLines.push(`Behavior Guidance: ${behavior.guidance.join(" | ")}`);
    }
    contextLines.push(`Current Date (UTC): ${runtimeDate.isoDate}`);
    if (input.recentMessages && input.recentMessages.length > 0) {
      const recent = input.recentMessages
        .slice(-4)
        .map((msg) => `${msg.role === "assistant" ? "Chris" : "User"}: ${msg.content}`)
        .join("\n");
      contextLines.push(`Recent Chat:\n${recent}`);
    }

    const userPrompt = [
      contextLines.length > 0 ? `Context:\n${contextLines.join("\n")}\n` : "",
      `User Question:\n${input.userMessage}`,
      "Answer the question directly. Be concise, grounded, and practical.",
    ].join("\n\n");

    const client = new GoogleGenAI({ apiKey });
    let reply = "";
    try {
      const response = await client.models.generateContent({
        model: "models/gemini-2.5-flash",
        contents: `${systemPolicy}\n\n${userPrompt}`,
        config: { temperature: 0 },
      });
      reply = typeof response.text === "string" ? response.text.trim() : "";
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }

    return {
      provider: this.id,
      reply:
        reply.length > 0
          ? reply
          : "I need one more detail before I can answer well. What role or job are we focusing on?",
      followUps: [],
    };
  }

  async analyzeSelectedJob(input: AnalyzeSelectedJobInput): Promise<AnalyzeSelectedJobOutput> {
    const runtimeDate = getRuntimeDateContext();
    console.log("TEST_ENV_VAR:", process.env.TEST_ENV_VAR);
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("[GeminiProvider] GEMINI_API_KEY present:", Boolean(apiKey && apiKey !== "your_real_key_here"));
    if (!apiKey || apiKey === "your_real_key_here") {
      return {
        provider: this.id,
        fitScore: 1,
        rubricScores: {
          experience: 0,
          evidence: 0,
          skills: 0,
          domain: 0,
          role: 0,
        },
        rubricExplanations: {
          experience: "Unable to score because Gemini is not configured.",
          evidence: "Unable to score because Gemini is not configured.",
          skills: "Unable to score because Gemini is not configured.",
          domain: "Unable to score because Gemini is not configured.",
          role: "Unable to score because Gemini is not configured.",
        },
        overallFitSummary:
          "Cannot run single-job analysis yet because GEMINI_API_KEY is missing on the server.",
        topStrengths: [],
        topGaps: ["Missing valid GEMINI_API_KEY in server environment."],
        riskAreas: ["Live model analysis is unavailable until key is configured."],
        highestPriorityImprovement: "Add a valid GEMINI_API_KEY and retry the analysis.",
        missingEvidence: ["Missing valid GEMINI_API_KEY in server environment."],
      };
    }

    const behavior = input.behaviorContext;
    const missingEvidence: string[] = [];
    if (!input.resumeContext.summary.trim()) {
      missingEvidence.push("Resume summary is missing.");
    }
    if (input.resumeContext.skills.length === 0) {
      missingEvidence.push("Resume skills are missing.");
    }
    if (input.resumeContext.experienceHighlights.length === 0) {
      missingEvidence.push("Resume experience section is missing.");
    }
    if (input.selectedJob.requiredSkills.length === 0) {
      missingEvidence.push("Selected job required skills are missing.");
    }
    if (!input.selectedJob.description.trim()) {
      missingEvidence.push("Selected job description is missing.");
    }

    const systemPolicy = behavior
      ? [
          "You are Coach Chris.",
          `Current date (UTC): ${runtimeDate.isoDate} (${runtimeDate.localeDate}).`,
          "Identity:",
          ...behavior.policy.identity.map((line) => `- ${line}`),
          "Core Rules:",
          ...behavior.policy.coreRules.map((line) => `- ${line}`),
          "Tone:",
          ...behavior.policy.tone.map((line) => `- ${line}`),
          "Mode Guidelines:",
          ...behavior.policy.modeGuidelines[behavior.mode].map((line) => `- ${line}`),
          "Output Rule: Return valid JSON only and no markdown fences.",
          "Speak directly to the user with you/your/your resume — never the candidate, he, she, his, or her.",
          "Put missing input fields only in missingEvidence, not in topGaps.",
          "Dates earlier than current date are not future dates.",
          "Expected future education dates are valid when labeled expected/anticipated.",
          "Do not ask users to confirm facts that are already explicit in the resume context.",
        ].join("\n")
      : [
          "You are Coach Chris.",
          `Current date (UTC): ${runtimeDate.isoDate}.`,
          "Never invent experience, metrics, or qualifications.",
          "Speak directly to the user with you/your/your resume.",
          "If resume input is missing, list it only in missingEvidence.",
          "Return valid JSON only and no markdown fences.",
        ].join("\n");

    const context = {
      selectedJob: input.selectedJob,
      resumeContext: input.resumeContext,
      fitContext: input.fitContext,
      optimizeContext: input.optimizeContext,
      behaviorGuidance: behavior?.guidance ?? [],
      missingEvidence,
      currentDate: runtimeDate.isoDate,
      technicalEvidenceChecklist: [
        "Skills",
        "Tools and Technologies",
        "Tech and AI",
        "AI tools",
        "Cursor",
        "Claude",
        "Gemini",
        "n8n",
        "Lovable",
        "technical collaboration",
        "systems/process work",
      ],
    };

    const userPrompt = [
      "Analyze the selected job against provided resume/context only.",
      "Do not use assumptions outside the provided context.",
      "Respond with JSON object with exactly these keys:",
      'experience (number 0-100), experienceExplanation (string), evidence (number 0-100), evidenceExplanation (string), skills (number 0-100), skillsExplanation (string), domain (number 0-100), domainExplanation (string), role (number 0-100), roleExplanation (string), overallFitSummary (string), topStrengths (string[] up to 3), topGaps (string[] up to 3), riskAreas (string[] up to 3), highestPriorityImprovement (string), missingEvidence (string[] up to 5).',
      "Only provide component scores. Do not provide an overall numeric fit score.",
      "Voice: write all user-facing strings in second person (you/your/your resume/your experience). Never use the candidate, he, she, his, or her.",
      "overallFitSummary, topStrengths, rubric explanations, topGaps, riskAreas, and highestPriorityImprovement must all use direct address.",
      "Keep topGaps focused on resume-vs-role mismatches (not missing input fields).",
      "Each topGap must use up to 3 short sentences in this order:",
      "1) Requirement: [specific job requirement].",
      "2) Your resume shows: [related evidence you found, or say it does not yet show this only after checking summary, skills, experience highlights, and education].",
      "3) Strengthen before applying: [one concrete, truthful resume edit].",
      "Evidence calibration:",
      "- Before any gap, scan skills, experience highlights, and education for tools/technologies, AI tools, product/building/prototyping, technical collaboration, and systems/process work.",
      "- Include evidence from sections such as Skills, Tools and Technologies, Tech and AI, AI tools, Cursor, Claude, Gemini, n8n, Lovable, technical collaboration, and systems/process work.",
      "- If some related but indirect evidence exists, say: 'Your resume shows some related evidence (e.g., ...), but not enough direct evidence of [requirement].'",
      "- Only say your resume does not yet show [X] when there is truly no related evidence in the provided resume context.",
      "- Do not use absolute phrasing like 'no evidence', 'doesn't show any', or 'zero engagement' when related tools, AI, product, or cross-functional work appears anywhere on the resume.",
      "Avoid generic phrasing like 'communication skills missing' or 'needs more leadership experience'.",
      "Keep riskAreas focused on hiring risk implications for you, distinct from topGaps.",
      "Put missing resume/job input fields only in missingEvidence (e.g., empty skills section).",
      "Keep topStrengths and riskAreas concise (one sentence each).",
      "Make highestPriorityImprovement a concrete action step on your summary or a bullet.",
      "",
      `Context JSON:\n${JSON.stringify(context, null, 2)}`,
    ].join("\n");

    const client = new GoogleGenAI({ apiKey });
    let raw = "";
    try {
      const response = await client.models.generateContent({
        model: "models/gemini-2.5-flash",
        contents: `${systemPolicy}\n\n${userPrompt}`,
        config: { temperature: 0 },
      });
      raw = typeof response.text === "string" ? response.text : "";
      console.log("GEMINI RAW:", raw);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
    const jsonText = extractJsonObject(raw);
    let parsed: Partial<AnalyzeSelectedJobOutput>;
    try {
      parsed = JSON.parse(jsonText) as Partial<AnalyzeSelectedJobOutput>;
    } catch {
      throw new Error("Gemini returned invalid JSON for selected-job analysis.");
    }

    const baseMissingEvidenceOutput = Array.isArray(parsed.missingEvidence)
      ? cleanList(parsed.missingEvidence.filter((item): item is string => typeof item === "string"), 5)
      : cleanList(missingEvidence, 5);
    const topGapsRaw = Array.isArray(parsed.topGaps)
      ? parsed.topGaps.filter((item): item is string => typeof item === "string")
      : missingEvidence.slice(0, 3);
    const riskAreasRaw = Array.isArray(parsed.riskAreas)
      ? parsed.riskAreas.filter((item): item is string => typeof item === "string")
      : missingEvidence.slice(0, 3);

    const movedMissingEvidence = cleanList(
      [...topGapsRaw, ...riskAreasRaw].filter(isMissingInputEvidenceLine),
      5,
    );
    const missingEvidenceOutput = cleanList(
      [...baseMissingEvidenceOutput, ...movedMissingEvidence],
      5,
    );
    const missingEvidenceKeys = new Set(missingEvidenceOutput.map((item) => normalizeKey(item)));

    const topGapsOutput = cleanList(
      topGapsRaw.filter((item) => !isMissingInputEvidenceLine(item)),
      3,
      missingEvidenceKeys,
    );

    const blockedForRisk = new Set<string>([
      ...missingEvidenceKeys,
      ...topGapsOutput.map((item) => normalizeKey(item)),
    ]);
    const riskAreasOutput = cleanList(
      riskAreasRaw.filter((item) => !isMissingInputEvidenceLine(item)),
      3,
      blockedForRisk,
    );

    const highestPriorityImprovement = ensureActionableNextStep(
      typeof parsed.highestPriorityImprovement === "string"
        ? parsed.highestPriorityImprovement
        : "",
      "Rewrite one resume bullet for this job and add one truthful, role-relevant outcome metric.",
    );

    const rubricScores = {
      experience: clampScore((parsed as { experience?: unknown }).experience, 40),
      evidence: clampScore((parsed as { evidence?: unknown }).evidence, 35),
      skills: clampScore((parsed as { skills?: unknown }).skills, 35),
      domain: clampScore((parsed as { domain?: unknown }).domain, 30),
      role: clampScore((parsed as { role?: unknown }).role, 35),
    };

    const fitScore = computeRubricFitScore(rubricScores);

    const rubricExplanations = {
      experience:
        typeof (parsed as { experienceExplanation?: unknown }).experienceExplanation === "string"
          ? (parsed as { experienceExplanation: string }).experienceExplanation.trim()
          : "How much depth and relevance your comparable role experience shows for this job.",
      evidence:
        typeof (parsed as { evidenceExplanation?: unknown }).evidenceExplanation === "string"
          ? (parsed as { evidenceExplanation: string }).evidenceExplanation.trim()
          : "How well your resume backs up claims with concrete examples.",
      skills:
        typeof (parsed as { skillsExplanation?: unknown }).skillsExplanation === "string"
          ? (parsed as { skillsExplanation: string }).skillsExplanation.trim()
          : "How much overlap there is between role needs and skills on your resume.",
      domain:
        typeof (parsed as { domainExplanation?: unknown }).domainExplanation === "string"
          ? (parsed as { domainExplanation: string }).domainExplanation.trim()
          : "How familiar your background looks with this role's domain.",
      role:
        typeof (parsed as { roleExplanation?: unknown }).roleExplanation === "string"
          ? (parsed as { roleExplanation: string }).roleExplanation.trim()
          : "How closely your scope and responsibilities align with this role.",
    };

    const topStrengthsClean = cleanList(
      Array.isArray(parsed.topStrengths)
        ? parsed.topStrengths.filter((item): item is string => typeof item === "string")
        : [],
      3,
    );
    const topGapsWithDriver = cleanList(topGapsOutput, 4, missingEvidenceKeys);

    return applyAnalysisUserFacingCopy({
      provider: this.id,
      fitScore,
      rubricScores,
      rubricExplanations,
      overallFitSummary:
        typeof parsed.overallFitSummary === "string" && parsed.overallFitSummary.trim().length > 0
          ? parsed.overallFitSummary.trim()
          : "Your resume evidence is incomplete, so this fit summary is directional only.",
      topStrengths: topStrengthsClean,
      topGaps: topGapsWithDriver,
      riskAreas: riskAreasOutput,
      highestPriorityImprovement,
      missingEvidence: missingEvidenceOutput,
    });
  }

  async generateInterviewQuestion(
    input: GenerateInterviewQuestionInput,
  ): Promise<GenerateInterviewQuestionOutput> {
    if (input.mode === "role-specific" && input.roleTitle && input.company) {
      return {
        provider: this.id,
        question: `Why are you a strong fit for the ${input.roleTitle} role at ${input.company}?`,
        coachingHint: "Lead with one concrete outcome, then connect directly to role needs.",
      };
    }
    return {
      provider: this.id,
      question: "Tell me about a time you drove impact through cross-functional collaboration.",
      coachingHint: "Use STAR and include one measurable result.",
    };
  }
}
