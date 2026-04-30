import { GoogleGenAI } from "@google/genai";
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
  return "No Fit";
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

function ensureActionableNextStep(step: string, fallback: string): string {
  const trimmed = step.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  const startsWithAction = /^(add|update|rewrite|replace|quantify|tailor|remove|clarify|prove)\b/.test(lower);
  return startsWithAction ? trimmed : fallback;
}

function isMissingEvidenceLine(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("missing") ||
    normalized.includes("not provided") ||
    normalized.includes("not available") ||
    normalized.includes("insufficient evidence") ||
    normalized.includes("no evidence")
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
        `Resume summary aligns with ${topSkills[0] ?? "core role requirements"}.`,
        `Role targeting is relevant to ${input.jobTitle} at ${input.company}.`,
      ],
      gaps: [
        "Add one quantified impact metric to strengthen evidence.",
        "Tailor one line to mirror the role's highest-priority requirement.",
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

  async generateCoachReply(input: GenerateCoachReplyInput): Promise<GenerateCoachReplyOutput> {
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
          "Identity:",
          ...behavior.policy.identity.map((line) => `- ${line}`),
          "Core Rules:",
          ...behavior.policy.coreRules.map((line) => `- ${line}`),
          "Tone:",
          ...behavior.policy.tone.map((line) => `- ${line}`),
          "Mode Guidelines:",
          ...behavior.policy.modeGuidelines[behavior.mode].map((line) => `- ${line}`),
        ].join("\n")
      : "You are Coach Chris. Be concise, practical, honest, and never invent experience or metrics.";

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
      missingEvidence.push("Resume experience highlights are missing.");
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
          "Identity:",
          ...behavior.policy.identity.map((line) => `- ${line}`),
          "Core Rules:",
          ...behavior.policy.coreRules.map((line) => `- ${line}`),
          "Tone:",
          ...behavior.policy.tone.map((line) => `- ${line}`),
          "Mode Guidelines:",
          ...behavior.policy.modeGuidelines[behavior.mode].map((line) => `- ${line}`),
          "Output Rule: Return valid JSON only and no markdown fences.",
          "If evidence is incomplete, explicitly list what is missing in topGaps and riskAreas.",
        ].join("\n")
      : [
          "You are Coach Chris.",
          "Never invent experience, metrics, or qualifications.",
          "If evidence is missing, explicitly say what is missing.",
          "Return valid JSON only and no markdown fences.",
        ].join("\n");

    const context = {
      selectedJob: input.selectedJob,
      resumeContext: input.resumeContext,
      fitContext: input.fitContext,
      optimizeContext: input.optimizeContext,
      behaviorGuidance: behavior?.guidance ?? [],
      missingEvidence,
    };

    const userPrompt = [
      "Analyze the selected job against provided resume/context only.",
      "Do not use assumptions outside the provided context.",
      "Respond with JSON object with exactly these keys:",
      'experience (number 0-100), experienceExplanation (string), evidence (number 0-100), evidenceExplanation (string), skills (number 0-100), skillsExplanation (string), domain (number 0-100), domainExplanation (string), role (number 0-100), roleExplanation (string), overallFitSummary (string), topStrengths (string[] up to 3), topGaps (string[] up to 3), riskAreas (string[] up to 3), highestPriorityImprovement (string), missingEvidence (string[] up to 5).',
      "Only provide component scores. Do not provide an overall numeric fit score.",
      "Keep topGaps focused on actual candidate-job mismatches (not missing input fields).",
      "Each topGap must be specific and contextual: name the missing evidence/experience, tie it to the role context, and explain why it matters.",
      "Avoid generic phrasing like 'communication skills missing' or 'needs more leadership experience'.",
      "Prefer concrete wording like 'No evidence of stakeholder communication in product delivery context, which weakens readiness for cross-functional launch ownership. Add one resume bullet showing partner alignment and delivery outcome.'",
      "When possible, make each topGap actionable by including a clear next improvement step.",
      "Keep riskAreas focused on hiring risk implications, distinct from topGaps.",
      "Put missing input or unknown evidence only in missingEvidence.",
      "Keep each item concise (one sentence max) and specific.",
      "Make highestPriorityImprovement a concrete action step on one artifact (summary or bullet).",
      "",
      `Context JSON:\n${JSON.stringify(context, null, 2)}`,
    ].join("\n");

    const client = new GoogleGenAI({ apiKey });
    let raw = "";
    try {
      const response = await client.models.generateContent({
        model: "models/gemini-2.5-flash",
        contents: `${systemPolicy}\n\n${userPrompt}`,
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
      [...topGapsRaw, ...riskAreasRaw].filter(isMissingEvidenceLine),
      5,
    );
    const missingEvidenceOutput = cleanList(
      [...baseMissingEvidenceOutput, ...movedMissingEvidence],
      5,
    );
    const missingEvidenceKeys = new Set(missingEvidenceOutput.map((item) => normalizeKey(item)));

    const topGapsOutput = cleanList(
      topGapsRaw.filter((item) => !isMissingEvidenceLine(item)),
      3,
      missingEvidenceKeys,
    );

    const blockedForRisk = new Set<string>([
      ...missingEvidenceKeys,
      ...topGapsOutput.map((item) => normalizeKey(item)),
    ]);
    const riskAreasOutput = cleanList(
      riskAreasRaw.filter((item) => !isMissingEvidenceLine(item)),
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
          : "Assesses depth and relevance of comparable role experience.",
      evidence:
        typeof (parsed as { evidenceExplanation?: unknown }).evidenceExplanation === "string"
          ? (parsed as { evidenceExplanation: string }).evidenceExplanation.trim()
          : "Assesses whether claims are supported by concrete resume evidence.",
      skills:
        typeof (parsed as { skillsExplanation?: unknown }).skillsExplanation === "string"
          ? (parsed as { skillsExplanation: string }).skillsExplanation.trim()
          : "Assesses overlap between role needs and demonstrated skills.",
      domain:
        typeof (parsed as { domainExplanation?: unknown }).domainExplanation === "string"
          ? (parsed as { domainExplanation: string }).domainExplanation.trim()
          : "Assesses relevant domain familiarity for this role context.",
      role:
        typeof (parsed as { roleExplanation?: unknown }).roleExplanation === "string"
          ? (parsed as { roleExplanation: string }).roleExplanation.trim()
          : "Assesses alignment with role scope and core responsibilities.",
    };

    const experienceDriverStrength =
      rubricScores.experience >= 65
        ? "Primary driver: your relevant experience depth is a strong match for this role."
        : "Primary driver to improve: strengthen direct role-relevant experience evidence.";
    const experienceDriverGap =
      rubricScores.experience < 60
        ? "Experience depth is the main gap right now; add one concrete example that matches this role's core responsibilities."
        : "Experience depth is solid; focus next on strengthening measurable evidence and role specificity.";

    const topStrengthsWithDriver = cleanList(
      [experienceDriverStrength, ...(
        Array.isArray(parsed.topStrengths)
          ? parsed.topStrengths.filter((item): item is string => typeof item === "string")
          : []
      )],
      3,
    );
    const topGapsWithDriver = cleanList(
      [experienceDriverGap, ...topGapsOutput],
      3,
      missingEvidenceKeys,
    );

    return {
      provider: this.id,
      fitScore,
      rubricScores,
      rubricExplanations,
      overallFitSummary:
        typeof parsed.overallFitSummary === "string" && parsed.overallFitSummary.trim().length > 0
          ? parsed.overallFitSummary.trim()
          : "Evidence is incomplete to produce a reliable fit summary.",
      topStrengths: topStrengthsWithDriver,
      topGaps: topGapsWithDriver,
      riskAreas: riskAreasOutput,
      highestPriorityImprovement,
      missingEvidence: missingEvidenceOutput,
    };
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
