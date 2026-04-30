"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getProviderConfig } from "@/lib/ai";
import {
  analyses,
  currentResume,
  getStoredJobStatuses,
  jobs,
  jobStatuses,
  optimizeByJob,
} from "@/mock-data/career-coach";
import { GENERAL_INTERVIEW_QUESTIONS } from "@/lib/interview-questions/general";
import {
  classifyInterviewInputIntent,
  type InterviewInputIntent,
} from "@/lib/interview-questions/intent-classifier";
import {
  getAllStoredJobs,
  getComputedJobAnalysesState,
  getSelectedJobId,
} from "@/lib/job-session-store";
import { inferConfidenceLevel } from "@/utils/fit";

function getPageContext(pathname: string): { label: string; hint: string } {
  if (pathname.startsWith("/dashboard")) return { label: "Dashboard", hint: "your application overview" };
  if (pathname.startsWith("/results")) return { label: "Results", hint: "your fit analysis" };
  if (pathname.startsWith("/optimize")) return { label: "Optimize", hint: "your resume optimization" };
  if (pathname.startsWith("/analyze")) return { label: "Analyze", hint: "your job analysis" };
  if (pathname.startsWith("/profile")) return { label: "Profile", hint: "your profile" };
  if (pathname.startsWith("/resume")) return { label: "Resume", hint: "your resume" };
  if (pathname.startsWith("/batch")) return { label: "Jobs", hint: "your saved jobs" };
  return { label: "Home", hint: "Coach Chris" };
}

type PromptDef = { id: string; label: string };
type MessageAction = { id: string; label: string };
type Message = { id: string; role: "user" | "assistant"; content: string; actions?: MessageAction[] };
type InterviewTrack = "general" | "role-specific";
type InterviewSessionPhase =
  | "idle"
  | "choosing-mode"
  | "choosing-role"
  | "ready"
  | "active";
type InterviewJob = { id: string; title: string; company: string };
type AnswerRelevance = "Relevant" | "Partially relevant" | "Irrelevant";
type InterviewAnswerQuality = "weak" | "partial" | "strong";
type InterviewQuestionType = "Behavioral" | "Narrative" | "Strategy";
type InterviewPrepContext = {
  fitScore: number | null;
  topGaps: string[];
  resumeSummary: string;
  resumeSkills: string[];
};
type PromptConfidenceLevel = "Low" | "Medium" | "High";
type ResultsJobContext = {
  jobId: string | null;
  title: string | null;
  company: string | null;
  fitScore: number | null;
  confidence: PromptConfidenceLevel | null;
  gaps: string[];
};

function sameResultsJobContext(a: ResultsJobContext | null, b: ResultsJobContext | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.jobId !== b.jobId ||
    a.title !== b.title ||
    a.company !== b.company ||
    a.fitScore !== b.fitScore ||
    a.confidence !== b.confidence
  ) {
    return false;
  }
  if (a.gaps.length !== b.gaps.length) return false;
  return a.gaps.every((gap, index) => gap === b.gaps[index]);
}

type PromptConfidenceLevel = "Low" | "Medium" | "High";
const OPTIMIZE_PROMPTS: PromptDef[] = [
  { id: "o1", label: "Explain this change" },
  { id: "o2", label: "Is this bullet too exaggerated?" },
  { id: "o3", label: "How can I make this stronger without inventing anything?" },
  { id: "o4", label: "Should I reword or remove this if I do not have a metric?" },
];
const DASHBOARD_PROMPTS: PromptDef[] = [
  { id: "d1", label: "Which roles should I prioritize?" },
  { id: "d3", label: "What should I work on first?" },
  { id: "d4", label: "Prep for an interview" },
];
const DEFAULT_PROMPTS: PromptDef[] = [
  { id: "x1", label: "What are the fit categories?" },
  { id: "x2", label: "What should I work on next?" },
  { id: "x3", label: "How does Chris evaluate my resume?" },
];

function getContextualPrompts(pathname: string): PromptDef[] {
  if (pathname.startsWith("/optimize")) return OPTIMIZE_PROMPTS;
  if (pathname.startsWith("/dashboard")) return DASHBOARD_PROMPTS;
  return DEFAULT_PROMPTS;
}

function getFitBand(score: number): "High Fit" | "Medium Fit" | "Low Fit" {
  if (score >= 70) return "High Fit";
  if (score >= 40) return "Medium Fit";
  return "Low Fit";
}

function buildResultsPrompts(options: {
  fitScore: number | null;
  confidence: PromptConfidenceLevel;
}): PromptDef[] {
  if (options.confidence === "Low") {
    return [
      { id: "r_missing_1", label: "What information is missing?" },
      { id: "r_missing_2", label: "How can I improve my resume?" },
    ];
  }

  if (options.fitScore === null) {
    return [
      { id: "r_default_1", label: "What are my biggest gaps?" },
      { id: "r_default_2", label: "How can I improve my chances?" },
    ];
  }

  const fitBand = getFitBand(options.fitScore);
  if (fitBand === "High Fit") {
    return [
      { id: "r_high_1", label: "Why is this a strong fit?" },
      { id: "r_high_2", label: "What should I emphasize?" },
    ];
  }
  if (fitBand === "Medium Fit") {
    return [
      { id: "r_mid_1", label: "What are my biggest gaps?" },
      { id: "r_mid_2", label: "How can I improve my chances?" },
    ];
  }
  return [
    { id: "r_low_1", label: "Why is this a weak fit?" },
    { id: "r_low_2", label: "Is this worth applying to?" },
  ];
}

function deriveConfidenceLevel(options: {
  resumeCompleteness: number;
  strengthCount: number;
  evidenceItems: string[];
  computedAnalysisState?: "ready" | "insufficient_evidence";
  missingEvidenceCount: number;
}): PromptConfidenceLevel {
  if (options.computedAnalysisState === "insufficient_evidence") return "Low";
  return inferConfidenceLevel({
    resumeCompleteness: options.resumeCompleteness,
    missingEvidenceCount: options.missingEvidenceCount,
    keyRequirementEvidenceCount: options.strengthCount,
    evidenceItems: options.evidenceItems,
  });
}

const MOCK_RESPONSES: Record<string, string> = {
  r1: "Your Northstar Labs experience maps directly to this role. Add one concrete activation metric to strengthen conversion odds.",
  r2: "Two gaps: missing quantified outcome and generic summary framing. Both are fixable quickly.",
  r3: "Yes. Tailor two lines first: one impact metric and one role-specific summary sentence.",
  r4: "Recruiters will see relevant experience, but impact evidence is underdeveloped.",
  o1: "Changes mirror the job description and tighten positioning without fabricating outcomes.",
  o2: "Language is stronger but still defensible. Keep only claims you can explain in interviews.",
  o3: "Increase specificity: scope, stakeholders, and measurable outcomes.",
  o4: "Keep truthful bullets; reword if no metric. Never invent numbers.",
  d1: "Prioritize Strong Fit roles first for highest return on effort.",
  d2: "Aspirational Fit roles are viable but need deeper tailoring.",
  d3: "Add missing metrics first, then submit strongest roles.",
  x1: "Fit is based on experience alignment and preference alignment.",
  x2: "Highest leverage now: add real metrics to top bullets.",
  x3: "Chris evaluates alignment, preference, keyword match, and quantified impact.",
};
const FALLBACK_RESPONSE =
  "Keep your narrative specific, truthful, and measurable. I can help tighten one answer or bullet at a time.";
const UNCLEAR_INPUT_FALLBACKS = [
  "I want to help, but I need a clearer question. Tell me the exact decision, bullet, or interview answer you want to work on.",
  "I need one specific target to give useful coaching. For example: 'Is this bullet too exaggerated?' or 'Should I apply to this role?'",
];

const INTERVIEW_FEEDBACK_SYSTEM_PROMPT = `You are Coach Chris giving interview feedback.

Classify the interview question into exactly one type:
- Behavioral
- Narrative
- Strategy

Then apply the matching framework:
- Behavioral -> STAR (Situation, Task, Action, Result)
- Narrative -> Past, Present, Future
- Strategy -> structured thinking (clear steps, prioritization, trade-offs, decision logic)

Return concise coaching with this structure:
1) What you did well
2) What is missing
3) How to improve on the next draft

Rules:
- Do not default to STAR for non-behavioral questions
- Avoid generic template language
- Be specific to the exact question and answer
- Keep tone conversational, practical, and encouraging
- End by asking the user to revise and try again`;

const INTERVIEW_PATTERNS = [
  /interview\s*(question|prep|practice)/i,
  /mock\s*interview/i,
  /sample\s*interview\s*questions/i,
  /practice\s*interview/i,
  /prep\s*(for|me|an)?\s*(interview)?/i,
  /prepare\s*(for|me)/i,
];

function hasInterviewIntent(text: string): boolean {
  return INTERVIEW_PATTERNS.some((p) => p.test(text));
}

function isUnclearFreeformInput(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.replace(/[\W_]/g, "").length < 3) return true;
  const vagueSignals = new Set([
    "help",
    "idk",
    "hmm",
    "ok",
    "okay",
    "sure",
    "whatever",
    "anything",
    "what",
    "why",
    "how",
  ]);
  if (vagueSignals.has(normalized)) return true;
  return false;
}
function isInterviewStartSignal(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  const startPhrases = [
    "ok lets start",
    "ok let's start",
    "lets start",
    "let's start",
    "start",
    "let's begin",
    "lets begin",
    "go ahead",
  ];
  return startPhrases.some((phrase) => normalized === phrase || normalized.includes(phrase));
}
function detectTrackFromText(text: string): InterviewTrack | null {
  const lower = text.toLowerCase();
  if (lower.includes("general interview") || lower.includes("general practice")) return "general";
  if (lower.includes("role-specific") || lower.includes("specific role") || lower.includes("this role")) return "role-specific";
  return null;
}
function getInterviewPrepContext(jobId: string): InterviewPrepContext {
  const computed = getComputedJobAnalysesState()[jobId];
  const staticAnalysis = analyses.find((analysis) => analysis.jobId === jobId);
  const selectedAnalysis = staticAnalysis ?? (computed?.analysisState === "ready" ? computed : undefined);
  return {
    fitScore: selectedAnalysis?.score ?? null,
    topGaps: (selectedAnalysis?.gaps ?? []).slice(0, 3),
    resumeSummary: currentResume.summary,
    resumeSkills: currentResume.skills,
  };
}

function buildGapFocusedQuestion(job: InterviewJob, gap: string): string {
  const text = gap.toLowerCase();

  if (text.includes("metric") || text.includes("quantified") || text.includes("outcome")) {
    return "Tell me about a time you worked on a product or feature and measured its impact. What was the outcome?";
  }
  if (text.includes("stakeholder") || text.includes("cross-functional") || text.includes("alignment")) {
    return "Tell me about a time you aligned cross-functional stakeholders around a difficult decision. How did you build alignment?";
  }
  if (text.includes("user research") || text.includes("user insights") || text.includes("interview")) {
    return "Tell me about a time you gathered user insights and used them to shape a product decision.";
  }
  if (text.includes("experiment") || text.includes("growth") || text.includes("funnel") || text.includes("conversion")) {
    return "Tell me about an experimentation project you ran. What did you test, and what did you learn?";
  }
  if (text.includes("ai") || text.includes("workflow") || text.includes("llm")) {
    return "Tell me about a time you designed or improved an AI-enabled workflow. How did you evaluate success?";
  }
  if (text.includes("api") || text.includes("platform") || text.includes("integration") || text.includes("technical")) {
    return "Tell me about a technically complex product problem you solved with engineering partners. How did you approach it?";
  }
  if (text.includes("domain") || text.includes("industry") || text.includes("payments")) {
    return "Tell me about a time you had to ramp up quickly in a new domain and still deliver strong results.";
  }

  return "Tell me about a product challenge you owned end to end and the result you achieved.";
}

function roleInterviewQuestions(job: InterviewJob, prep: InterviewPrepContext): string[] {
  const gapQuestions = prep.topGaps
    .slice(0, 3)
    .map((gap) => buildGapFocusedQuestion(job, gap));
  return [
    ...gapQuestions,
    `For the ${job.title} role at ${job.company}, what is your strongest evidence of role-relevant ownership?`,
    `How would you approach your first 90 days in this ${job.title} position?`,
    `What is one difficult trade-off in this role, and how would you handle it?`,
  ];
}
function firstGeneralInterviewQuestion(): string {
  return "Let’s begin. Walk me through your background and the role transition you are targeting right now.";
}
function firstRoleInterviewQuestion(job: InterviewJob, prep: InterviewPrepContext): string {
  if (prep.topGaps.length > 0) {
    const firstGapQuestion = buildGapFocusedQuestion(job, prep.topGaps[0]);
    return `Let’s prep for ${job.company} — ${job.title}.\n\n${firstGapQuestion}`;
  }
  return `Let’s prep for ${job.company} — ${job.title}.\n\nFor the ${job.title} role at ${job.company}, what experience best proves your fit?`;
}
function nextQuestion(
  track: InterviewTrack,
  index: number,
  job: InterviewJob | null,
  prep?: InterviewPrepContext,
): string {
  if (track === "general") return GENERAL_INTERVIEW_QUESTIONS[index % GENERAL_INTERVIEW_QUESTIONS.length];
  if (!job) return "Which interview-stage role should we focus on?";
  const questions = roleInterviewQuestions(
    job,
    prep ?? {
      fitScore: null,
      topGaps: [],
      resumeSummary: "",
      resumeSkills: [],
    },
  );
  return questions[index % questions.length];
}
function buildShortFeedback(answer: string): string {
  if (answer.trim().length < 80) return "Good start. Add one specific outcome.";
  if (!/\d/.test(answer)) return "Clear answer. Add one metric for impact.";
  return "Strong structure. Tighten your ending in one sentence.";
}
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
function classifyAnswerRelevance(question: string, answer: string): AnswerRelevance {
  const normalizedAnswer = answer.trim().toLowerCase();
  if (!normalizedAnswer || normalizedAnswer.split(/\s+/).length < 3) {
    return "Irrelevant";
  }

  const obviousOffTopic = [
    "how are you",
    "hello",
    "hi",
    "what's up",
    "whats up",
    "idk",
    "i don't know",
    "i dont know",
  ];
  if (obviousOffTopic.some((phrase) => normalizedAnswer === phrase || normalizedAnswer.includes(phrase))) {
    return "Irrelevant";
  }

  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "for",
    "of",
    "in",
    "on",
    "at",
    "is",
    "are",
    "you",
    "your",
    "this",
    "that",
    "with",
    "why",
    "what",
    "how",
    "me",
    "my",
    "i",
  ]);

  const questionTokens = tokenize(question).filter((token) => !stopWords.has(token));
  const answerTokens = new Set(tokenize(answer).filter((token) => !stopWords.has(token)));

  if (questionTokens.length === 0) {
    return "Partially relevant";
  }

  const overlap = questionTokens.filter((token) => answerTokens.has(token)).length;
  const overlapRatio = overlap / questionTokens.length;

  const professionalSignals = [
    "experience",
    "background",
    "skills",
    "fit",
    "led",
    "managed",
    "built",
    "delivered",
    "impact",
    "result",
    "team",
    "role",
  ];
  const signalHits = professionalSignals.filter((token) => answerTokens.has(token)).length;

  if (overlapRatio >= 0.25 || (overlapRatio >= 0.15 && signalHits >= 2)) {
    return "Relevant";
  }
  if (overlapRatio > 0 || signalHits >= 1) {
    return "Partially relevant";
  }
  return "Irrelevant";
}

function classifyInterviewAnswerQuality(answer: string): InterviewAnswerQuality {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return "weak";
  if (normalized.length < 25) return "weak";

  const weakSignals = [
    "idk",
    "i don't know",
    "i dont know",
    "not sure",
    "no idea",
    "maybe",
  ];
  if (weakSignals.some((signal) => normalized === signal || normalized.includes(signal))) {
    return "weak";
  }

  const hasMetric = /\d/.test(answer);
  const hasActionVerb = [
    "led",
    "built",
    "shipped",
    "improved",
    "reduced",
    "increased",
    "delivered",
    "launched",
    "coordinated",
  ].some((verb) => normalized.includes(verb));
  const hasOutcomeSignal = [
    "result",
    "impact",
    "outcome",
    "improved",
    "increased",
    "reduced",
  ].some((signal) => normalized.includes(signal));

  if (hasActionVerb && (hasMetric || hasOutcomeSignal) && normalized.length >= 90) {
    return "strong";
  }
  return "partial";
}

function getRoleHintFromQuestion(question: string): string {
  const lower = question.toLowerCase();
  if (lower.includes(" at ")) return "for this specific role";
  if (lower.includes("first 90 days")) return "for this role's early-impact expectations";
  if (lower.includes("strong fit")) return "for this role's fit criteria";
  return "for the role requirements in this question";
}

function buildStarPrompt(options: {
  missingSituation?: boolean;
  missingTask?: boolean;
  missingAction?: boolean;
  missingResult?: boolean;
}): string {
  const missing: string[] = [];
  if (options.missingSituation) missing.push("Situation: where/when this happened.");
  if (options.missingTask) missing.push("Task: what you were responsible for.");
  if (options.missingAction) missing.push("Action: what you personally did.");
  if (options.missingResult) missing.push("Result: what changed (ideally with a metric).");
  if (missing.length === 0) {
    return "Use STAR to tighten it: brief Situation, clear Task, specific Action ownership, measurable Result.";
  }
  return `To strengthen your STAR structure, add: ${missing.join(" ")}`;
}

function classifyInterviewQuestionType(question: string): InterviewQuestionType {
  const q = question.toLowerCase();
  const narrativeSignals = [
    "walk me through your background",
    "tell me about yourself",
    "your background",
    "why now",
    "why this role",
  ];
  if (narrativeSignals.some((signal) => q.includes(signal))) return "Narrative";

  const strategySignals = [
    "how would you approach",
    "what is one difficult trade-off",
    "first 90 days",
    "prioritize",
    "plan",
    "strategy",
  ];
  if (strategySignals.some((signal) => q.includes(signal))) return "Strategy";

  return "Behavioral";
}


function buildMetaWhyResponse(question: string): string {
  const questionType = classifyInterviewQuestionType(question);
  if (questionType === "Behavioral") {
    return "Great question. This is a behavioral question, so STAR fits because interviewers want proof from a real past example: Situation gives context, Task shows responsibility, Action shows your decisions, and Result shows impact. They’re checking whether you can deliver similar outcomes in this role.";
  }
  if (questionType === "Narrative") {
    return "Great question. This is a narrative question, so they’re evaluating your positioning and clarity. Past -> Present -> Future helps you show where you came from, what strengths you bring now, and why this role is your logical next step. They want a clear story, not a random timeline.";
  }
  return "Great question. This is a strategy question, so interviewers are testing how you think. They want to hear a structured approach: how you diagnose the problem, prioritize options, manage trade-offs, and define success. They care about your decision logic, not just your final answer.";
}

function buildMetaWhatResponse(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes("star")) {
    return "STAR is a structure for answering behavioral interview questions: Situation (context), Task (your responsibility), Action (what you personally did), and Result (what changed, ideally with a metric).";
  }
  if (lower.includes("behavioral")) {
    return "A behavioral interview question asks for a real example from your past work to predict how you handle similar situations in the future.";
  }
  if (lower.includes("narrative")) {
    return "A narrative answer structure is Past -> Present -> Future: where you came from, what you do now, and why this role is your logical next step.";
  }
  if (lower.includes("strategy") || lower.includes("framework")) {
    return "A strategy-style interview answer is a structured plan: diagnose the problem, prioritize options, explain trade-offs, and define success metrics.";
  }
  if (lower.includes("trade-off") || lower.includes("tradeoff")) {
    return "A trade-off is a choice between competing priorities where improving one outcome usually requires sacrificing another.";
  }
  return "In interview prep, a framework is a simple structure that helps you give clear, complete, and easy-to-follow answers.";
}

function buildInterviewHelpGuidance(question: string): string {
  const type = classifyInterviewQuestionType(question);
  if (type === "Narrative") {
    return "Start with Past -> Present -> Future: one short line on where you started, one line on what you do now, and one line on why this role is your next step. Try a 3-4 sentence draft.";
  }
  if (type === "Strategy") {
    return "Use a clear structure: 1) how you diagnose, 2) how you prioritize, 3) how you execute, 4) how you measure success. Keep each step to one sentence.";
  }
  return "Use STAR in 4 lines: Situation, Task, Action, Result. Keep it concrete and focus on what you personally did.";
}

function buildWeakUnsureGuidance(question: string): string {
  const type = classifyInterviewQuestionType(question);
  if (type === "Narrative") {
    return "No worries — start simple: where you were, what you’re doing now, and why this role is next. Write a short draft and I’ll help you sharpen it.";
  }
  if (type === "Strategy") {
    return "All good — start with one practical plan: what you would do first, what comes second, and how you’d decide priorities.";
  }
  return "Totally fine to pause here. Start with one real example from your work, then describe what happened and what changed because of your actions.";
}

type AnswerReadiness = {
  quality: InterviewAnswerQuality;
  isComplete: boolean;
  hasMetric: boolean;
  hasActionVerb: boolean;
  hasOutcomeSignal: boolean;
};

function assessAnswerReadiness(answer: string): AnswerReadiness {
  const normalized = answer.trim().toLowerCase();
  const quality = classifyInterviewAnswerQuality(answer);
  const hasMetric = /\d/.test(answer);
  const hasActionVerb = [
    "led",
    "built",
    "shipped",
    "improved",
    "reduced",
    "increased",
    "delivered",
    "launched",
    "coordinated",
    "owned",
  ].some((verb) => normalized.includes(verb));
  const hasOutcomeSignal = [
    "result",
    "impact",
    "outcome",
    "improved",
    "increased",
    "reduced",
  ].some((signal) => normalized.includes(signal));
  const isComplete = normalized.length >= 90 && hasActionVerb && (hasMetric || hasOutcomeSignal);
  return { quality, isComplete, hasMetric, hasActionVerb, hasOutcomeSignal };
}

function buildDecisionShouldResponse(answer: string): string {
  const readiness = assessAnswerReadiness(answer);
  if (readiness.quality === "strong" && readiness.isComplete) {
    return "Recommendation: move on. This answer is strong and complete enough for interview use.";
  }
  if (readiness.quality === "partial" && readiness.isComplete) {
    return "Recommendation: move on if you're time-boxed; otherwise do one quick polish pass before moving on.";
  }
  if (readiness.quality === "partial") {
    if (!readiness.hasMetric) {
      return "Recommendation: continue and revise once. Add one concrete result metric, then move on.";
    }
    return "Recommendation: continue for one revision. Tighten ownership and outcome, then move on.";
  }
  return "Recommendation: continue. This is not ready yet - give a clearer example with your specific actions and result before moving on.";
}

function buildDecisionWhenResponse(answer: string): string {
  const readiness = assessAnswerReadiness(answer);
  if (readiness.quality === "strong" && readiness.isComplete) {
    return "Move on now. Your threshold is met: clear ownership, clear outcome, and enough detail to sound credible.";
  }
  if (readiness.quality === "partial") {
    return "Move on when this threshold is met: 3-5 concise sentences, one clear ownership statement, and one concrete result (preferably a number). You are close.";
  }
  return "Move on when you can state: what happened, what you personally did, and what changed because of it. Right now that threshold is not met.";
}


function buildNarrativePrompt(options: {
  missingPast?: boolean;
  missingPresent?: boolean;
  missingFuture?: boolean;
}): string {
  const missing: string[] = [];
  if (options.missingPast) missing.push("Past: what experience shaped your fit.");
  if (options.missingPresent) missing.push("Present: what you are doing now and your current strengths.");
  if (options.missingFuture) missing.push("Future: why this role is your next logical step.");
  if (missing.length === 0) {
    return "Use Past -> Present -> Future with clear transitions so your story flows naturally.";
  }
  return `Strengthen your story by adding: ${missing.join(" ")}`;
}

function buildStrategyPrompt(options: {
  missingFramework?: boolean;
  missingPrioritization?: boolean;
  missingTradeoffs?: boolean;
}): string {
  const missing: string[] = [];
  if (options.missingFramework) missing.push("a step-by-step approach");
  if (options.missingPrioritization) missing.push("clear prioritization criteria");
  if (options.missingTradeoffs) missing.push("explicit trade-offs and rationale");
  if (missing.length === 0) {
    return "Keep your answer in a clear sequence: diagnose -> prioritize -> execute -> measure.";
  }
  return `Make your thinking more structured by adding ${missing.join(", ")}.`;
}

function buildInterviewFeedback(question: string, answer: string): string {
  const relevance = classifyAnswerRelevance(question, answer);
  const quality = classifyInterviewAnswerQuality(answer);
  const questionType = classifyInterviewQuestionType(question);
  const normalized = answer.toLowerCase();
  const roleHint = getRoleHintFromQuestion(question);
  const hasSituationSignal = ["at ", "when ", "while ", "in my role", "project", "team"].some(
    (signal) => normalized.includes(signal),
  );
  const hasTaskSignal = [
    "my goal",
    "i needed to",
    "i was responsible",
    "i owned",
    "my task",
    "objective",
    "target",
  ].some((signal) => normalized.includes(signal));
  const hasActionSignal = [
    "i led",
    "i built",
    "i shipped",
    "i improved",
    "i reduced",
    "i increased",
    "i coordinated",
    "i owned",
  ].some((signal) => normalized.includes(signal));
  const hasResultSignal =
    /\d/.test(answer) ||
    ["result", "impact", "outcome", "improved", "reduced", "increased"].some((signal) =>
      normalized.includes(signal),
    );
  const hasPastSignal = ["before", "started", "background", "previously", "in my past role"].some((signal) =>
    normalized.includes(signal),
  );
  const hasPresentSignal = ["currently", "now", "today", "right now", "my current"].some((signal) =>
    normalized.includes(signal),
  );
  const hasFutureSignal = ["next", "going forward", "this role", "future", "want to"].some((signal) =>
    normalized.includes(signal),
  );
  const hasStepSignal =
    /\b(first|second|third|then|finally|step)\b/.test(normalized) ||
    ["approach", "plan", "framework"].some((signal) => normalized.includes(signal));
  const hasPrioritizationSignal = ["priority", "prioritize", "highest impact", "order"].some((signal) =>
    normalized.includes(signal),
  );
  const hasTradeoffSignal = ["trade-off", "tradeoff", "risk", "constraint", "balance"].some((signal) =>
    normalized.includes(signal),
  );

  if (quality === "weak") {
    if (questionType === "Narrative") {
      return `Good start — this is easier once you anchor your story. For this question ${roleHint}, use Past -> Present -> Future: where you started, what you do well now, and why this role is your next step. Share a short draft and I’ll tighten it.`;
    }
    if (questionType === "Strategy") {
      return `Good start — let’s structure your thinking ${roleHint}. Try: 1) how you diagnose the problem, 2) how you prioritize options, 3) how you execute and measure outcomes. Send a first pass and I’ll refine it.`;
    }
    return `Good start — this question can be tough in the moment. Let’s build it with full STAR ${roleHint}: Situation (what was happening), Task (what you were responsible for), Action (what you did), Result (what changed). Start with one real example in 4 short lines and I’ll help you improve it.`;
  }

  if (quality === "partial") {
    if (questionType === "Narrative") {
      return `You have a solid base, but the story flow is incomplete ${roleHint}. ${buildNarrativePrompt({
        missingPast: !hasPastSignal,
        missingPresent: !hasPresentSignal,
        missingFuture: !hasFutureSignal,
      })} Keep it concise and connect each part clearly.`;
    }
    if (questionType === "Strategy") {
      return `Good start — now make your reasoning easier to follow ${roleHint}. ${buildStrategyPrompt({
        missingFramework: !hasStepSignal,
        missingPrioritization: !hasPrioritizationSignal,
        missingTradeoffs: !hasTradeoffSignal,
      })}`;
    }
    if (relevance === "Irrelevant") {
      return `You’re on the right track, but this drifts from what they asked ${roleHint}. ${buildStarPrompt({
        missingSituation: !hasSituationSignal,
        missingTask: !hasTaskSignal,
        missingAction: !hasActionSignal,
        missingResult: !hasResultSignal,
      })} Then end with one sentence that directly answers: "${question}"`;
    }
    return `You already have useful content. Now make it interview-ready ${roleHint}: Situation (short context), Task (your responsibility), Action (your ownership), Result (impact). ${buildStarPrompt({
      missingSituation: !hasSituationSignal,
      missingTask: !hasTaskSignal,
      missingAction: !hasActionSignal,
      missingResult: !hasResultSignal,
    })} Want to try a revised answer?`;
  }

  if (relevance !== "Relevant") {
    if (questionType === "Narrative") {
      return `Strong content, but tighten the storyline so it directly answers this narrative prompt ${roleHint}. Keep Past -> Present -> Future and make the final line clearly about why this role now.`;
    }
    if (questionType === "Strategy") {
      return `Strong ideas, but connect them more directly to the strategy asked ${roleHint}. Keep your structure explicit and tie each step back to decision criteria.`;
    }
    return `Strong example quality and good substance. To make it tighter ${roleHint}, keep your STAR points but connect the result more directly back to: "${question}"`;
  }
  if (questionType === "Narrative") {
    return "Strong narrative. To polish it, sharpen transitions between Past -> Present -> Future and end with a clear role-fit statement.";
  }
  if (questionType === "Strategy") {
    return "Strong strategic answer. To level it up, make prioritization criteria explicit and call out one key trade-off you would manage.";
  }
  return `Strong answer. To polish it for this role, lead with your headline impact, make ownership explicit, and add one concrete metric so the result is easier to trust.`;
}
function findMentionedJob(text: string, interviewJobs: InterviewJob[]): InterviewJob | undefined {
  const lower = text.toLowerCase();
  return interviewJobs.find((j) => lower.includes(j.company.toLowerCase()) || lower.includes(j.title.toLowerCase()));
}
function interviewActions(track: InterviewTrack): MessageAction[] {
  return [
    { id: "mock:next", label: "Next question" },
    { id: "mock:harder", label: "Harder question" },
    ...(track === "general"
      ? [{ id: "mock:switch-role", label: "Switch to role-specific questions" }]
      : [{ id: "mock:switch-general", label: "Switch to general questions" }]),
  ];
}

function buildRoleSpecificPrepMessage(interviewJobs: InterviewJob[]): string {
  if (interviewJobs.length === 0) {
    return "You don’t have any roles in the interview stage yet. Once you mark a job as ‘For Interview’, I can help you prepare.";
  }

  const listedRoles = interviewJobs.map((job) => `• ${job.company} — ${job.title}`).join("\n");
  if (interviewJobs.length === 1) {
    return `You have 1 role in the interview stage:\n\n${listedRoles}\n\nDo you want to start preparing for this role?`;
  }

  return `You currently have ${interviewJobs.length} roles in the interview stage:\n\n${listedRoles}\n\nWhich one do you want to prep for?`;
}

function getConfidenceRank(confidence: PromptConfidenceLevel): number {
  if (confidence === "High") return 3;
  if (confidence === "Medium") return 2;
  return 1;
}

function buildRoleLabel(input: { title?: string; company?: string }): string {
  const title = input.title?.trim();
  const company = input.company?.trim();
  if (company && title) return `${company} - ${title}`;
  if (title) return title;
  if (company) return company;
  return "This role";
}

type ResultsIntent = "fit_explanation" | "decision" | "none";

function isFitDecisionPrompt(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower.includes("should i apply") ||
    lower.includes("is this worth applying") ||
    lower.includes("should i prioritize") ||
    lower.includes("what should i do next") ||
    lower.includes("what should i do with this role") ||
    lower.includes("applying for a role") ||
    lower.includes("this role") ||
    lower.includes("my fit is")
  );
}

function isFitExplanationPrompt(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower.includes("fit") ||
    lower.includes("match") ||
    lower.includes("how good") ||
    lower.includes("how do i compare")
  );
}

function classifyResultsIntent(text: string): ResultsIntent {
  if (isFitExplanationPrompt(text) && !isFitDecisionPrompt(text)) {
    return "fit_explanation";
  }
  if (isFitDecisionPrompt(text)) {
    return "decision";
  }
  return "none";
}

function normalizeDecisionPrompt(text: string): string {
  const normalized = text.trim().toLowerCase();
  if (
    normalized.includes("applying for a role") ||
    normalized.includes("this role") ||
    normalized.includes("my fit is")
  ) {
    return "Should I apply for this role?";
  }
  return text.trim() || "Should I apply for this role?";
}

function buildFitConfidenceDecisionResponse(options: {
  fitScore: number;
  confidence: PromptConfidenceLevel;
  roleLabel: string;
}): string {
  const { fitScore, confidence, roleLabel } = options;

  if (fitScore >= 70) {
    if (confidence === "High") {
      return `${roleLabel} is a strong match - I’d prioritize this role and apply now.`;
    }
    if (confidence === "Low") {
      return `${roleLabel} could be a strong match, but your resume does not prove it clearly yet. Strengthen your examples first, then apply.`;
    }
    return `${roleLabel} looks promising. I’d apply, but do one focused polish pass on evidence before submitting.`;
  }

  if (fitScore < 40) {
    if (confidence === "High") {
      return `${roleLabel} is not a strong match based on your current experience - I would not prioritize this role.`;
    }
    if (confidence === "Low") {
      return `${roleLabel} is unclear and missing key evidence. Focus on stronger matches for now.`;
    }
    return `${roleLabel} is currently a weak match. Keep it as a backup and prioritize stronger-fit roles first.`;
  }

  if (confidence === "High") {
    return `${roleLabel} is a reasonable match. I’d apply selectively after your top-priority strong-fit roles.`;
  }
  if (confidence === "Low") {
    return `${roleLabel} might be viable, but evidence is too thin right now. Improve specificity before deciding.`;
  }
  return `${roleLabel} is a middle-fit option. Apply if your stronger roles are already in motion, and tailor your evidence first.`;
}

function getSimpleFitLevel(score: number): "High" | "Medium" | "Low" {
  if (score >= 70) return "High";
  if (score < 40) return "Low";
  return "Medium";
}

function buildFitExplanationResponse(options: {
  fitScore: number;
  confidence: PromptConfidenceLevel;
  strengths: string[];
  gaps: string[];
  roleTitle?: string;
}): string {
  const roleLabel = options.roleTitle || "This role";
  const fitLevel = getSimpleFitLevel(options.fitScore);
  const topStrength = options.strengths[0] ?? "your background shows relevant overlap";
  const topGap = options.gaps[0] ?? "key role evidence is still thin";
  const confidenceExplanation =
    options.confidence === "High"
      ? "This read is well supported by clear evidence in your background."
      : options.confidence === "Medium"
      ? "This read is directionally useful, but some evidence is still thin or incomplete."
      : "This read is still uncertain because key evidence is missing or too vague.";
  const summary =
    fitLevel === "High"
      ? `You’re well aligned with the core requirements here, especially around ${topStrength.toLowerCase()}.`
      : fitLevel === "Medium"
      ? `You have some relevant overlap here, with the clearest alignment around ${topStrength.toLowerCase()}.`
      : `Right now the alignment looks limited, even though ${topStrength.toLowerCase()} gives you a starting point.`;

  const improvementBullets = (options.gaps.length > 0 ? options.gaps : ["add clearer evidence of impact"])
    .slice(0, 3)
    .map((gap) => `• ${gap.charAt(0).toLowerCase()}${gap.slice(1)}`);

  const recommendation =
    fitLevel === "High" && options.confidence === "High"
      ? "This is a strong role to prioritize."
      : fitLevel === "High"
      ? "This looks promising, but strengthen your proof points before applying."
      : fitLevel === "Low"
      ? "I’d focus on stronger matches before spending time here."
      : "This is worth considering, but not ahead of your strongest matches.";

  return `${roleLabel} fit is ${fitLevel} (${options.fitScore}).

Fit summary:
${summary}

Confidence:
${confidenceExplanation}

Strongest signal:
${topStrength}

Biggest gap:
${topGap}

To strengthen further, focus on:
${improvementBullets.join("\n")}

${recommendation}`;
}

function buildLocalResultsFallbackResponse(options: {
  userText: string;
  roleLabel: string;
  analysis: JobAnalysis;
  confidence: PromptConfidenceLevel;
}): string {
  const intent = classifyResultsIntent(options.userText);
  if (intent === "decision") {
    return buildFitConfidenceDecisionResponse({
      fitScore: options.analysis.score,
      confidence: options.confidence,
      roleLabel: options.roleLabel,
    });
  }
  if (intent === "fit_explanation") {
    return buildFitExplanationResponse({
      fitScore: options.analysis.score,
      confidence: options.confidence,
      strengths: options.analysis.strengths,
      gaps: options.analysis.gaps,
      roleTitle: options.roleLabel,
    });
  }
  const topStrength = options.analysis.strengths[0] ?? "your profile has relevant overlap";
  const topGap = options.analysis.gaps[0] ?? "evidence is still light on outcomes";
  return `${options.roleLabel} fit is ${getSimpleFitLevel(options.analysis.score)} (${options.analysis.score}).

Fit summary:
You have some relevant overlap, but the signal is not complete yet.

Confidence:
This read is ${options.confidence.toLowerCase()}, so use it as guidance rather than a final verdict.

Strongest signal:
${topStrength}

Biggest gap:
${topGap}

Recommendation:
Strengthen one proof point, then decide whether to prioritize this role.`;
}

function buildPrioritizedRolesResponse(): string {
  const allJobs = getAllStoredJobs(jobs);
  const computed = getComputedJobAnalysesState();

  const scored = allJobs
    .map((job) => {
      const staticAnalysis = analyses.find((analysis) => analysis.jobId === job.id);
      const computedAnalysis = computed[job.id];
      const analysis =
        staticAnalysis ?? (computedAnalysis?.analysisState === "ready" ? computedAnalysis : undefined);
      if (!analysis) return null;

      const confidence = deriveConfidenceLevel({
        resumeCompleteness: 0.7,
        strengthCount: analysis.strengths.length,
        evidenceItems: analysis.strengths,
        computedAnalysisState: computedAnalysis?.analysisState,
        missingEvidenceCount: computedAnalysis?.missingEvidence.length ?? 0,
      });

      return {
        company: job.company,
        role: job.title,
        fitScore: analysis.score,
        confidence,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      return getConfidenceRank(b.confidence) - getConfidenceRank(a.confidence);
    });

  if (scored.length === 0) {
    return "I don’t have scored roles yet. Run fit analysis on your saved jobs, then I can prioritize them with fit and confidence.";
  }

  const splitIndex = Math.max(1, Math.ceil(scored.length / 2));
  const topPriority = scored.slice(0, splitIndex);
  const lowerPriority = scored.slice(splitIndex);

  const topLines = topPriority
    .map(
      (item) =>
        `• ${item.company} — ${item.role} (Fit ${item.fitScore}, Confidence ${item.confidence})`,
    )
    .join("\n");
  const lowerLines =
    lowerPriority.length > 0
      ? lowerPriority
          .map(
            (item) =>
              `• ${item.company} — ${item.role} (Fit ${item.fitScore}, Confidence ${item.confidence})`,
          )
          .join("\n")
      : "• None right now";

  return `Based on your current scored roles, here’s the priority order:\n\nTop priority roles:\n${topLines}\n\nLower priority roles:\n${lowerLines}`;
}

let messageCounter = 0;
function nextId() {
  return `msg-${++messageCounter}`;
}

function renderContent(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.startsWith("**") && seg.endsWith("**") ? (
          <strong key={i} className="font-semibold text-zinc-800">
            {seg.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{seg}</span>
        ),
      )}
    </span>
  );
}

function normalizeGapTheme(gap: string): string {
  const text = gap.toLowerCase();
  if (text.includes("add metric") || text.includes("quantified") || text.includes("metric")) {
    return "Quantified impact (metrics)";
  }
  if (text.includes("stakeholder") || text.includes("cross-functional") || text.includes("alignment")) {
    return "Stakeholder + cross-functional alignment";
  }
  if (text.includes("user research") || text.includes("user insights") || text.includes("interviews")) {
    return "User research evidence";
  }
  if (text.includes("experiment") || text.includes("growth") || text.includes("funnel") || text.includes("conversion")) {
    return "Experimentation + funnel outcomes";
  }
  if (text.includes("ai") || text.includes("workflow") || text.includes("llm")) {
    return "AI / workflow relevance";
  }
  if (text.includes("api") || text.includes("platform") || text.includes("integration") || text.includes("technical")) {
    return "Technical / platform depth";
  }
  if (text.includes("domain") || text.includes("payments") || text.includes("industry")) {
    return "Domain narrative";
  }
  return "Role-specific evidence gaps";
}

function buildWorkFirstCrossJobResponse(): string {
  const allJobs = getAllStoredJobs(jobs);
  const computed = getComputedJobAnalysesState();

  const analyzedItems = allJobs
    .map((job) => {
      const staticAnalysis = analyses.find((analysis) => analysis.jobId === job.id);
      const computedAnalysis = computed[job.id];
      const analysis =
        staticAnalysis ?? (computedAnalysis?.analysisState === "ready" ? computedAnalysis : undefined);
      if (!analysis) return null;
      return {
        jobId: job.id,
        company: job.company,
        role: job.title,
        gaps: analysis.gaps,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (analyzedItems.length === 0) {
    return "I don’t have gap data across your jobs yet. Run fit analysis on a few roles first, then I can identify the highest-leverage improvements across them.";
  }

  const themeToJobs = new Map<string, Set<string>>();
  for (const item of analyzedItems) {
    for (const gap of item.gaps) {
      const theme = normalizeGapTheme(gap);
      const key = theme;
      const set = themeToJobs.get(key) ?? new Set<string>();
      set.add(`${item.company} — ${item.role}`);
      themeToJobs.set(key, set);
    }
  }

  const ranked = Array.from(themeToJobs.entries())
    .map(([theme, affected]) => ({ theme, affected, count: affected.size }))
    .sort((a, b) => b.count - a.count);

  const top = ranked.slice(0, 3);
  const lines = top
    .map((item, index) => {
      const affectedList = Array.from(item.affected).slice(0, 4).join("\n  ");
      const extra = item.affected.size > 4 ? `\n  …and ${item.affected.size - 4} more` : "";
      return `${index + 1}) ${item.theme}\n  Affects:\n  ${affectedList}${extra}`;
    })
    .join("\n\n");

  return `Here are the highest-leverage areas to work on across your analyzed roles:\n\n${lines}\n\nIf you want, pick #1 and I’ll help you draft one improved bullet (with a real metric) that you can reuse across roles.`;
}

export function ChrisAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [statuses, setStatuses] = useState(jobStatuses);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [interviewTrack, setInterviewTrack] = useState<InterviewTrack | null>(null);
  const [interviewPhase, setInterviewPhase] = useState<InterviewSessionPhase>("idle");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [usedGeneralQuestionIndexes, setUsedGeneralQuestionIndexes] = useState<number[]>([]);
  const [lastAnswer, setLastAnswer] = useState("");
  const [activeInterviewQuestion, setActiveInterviewQuestion] = useState<string | null>(null);
  const [selectedInterviewJobId, setSelectedInterviewJobId] = useState<string | null>(null);
  const [hasShownFallbackInInterview, setHasShownFallbackInInterview] =
    useState(false);
  const [freeformFallbackCount, setFreeformFallbackCount] = useState(0);
  const [resultsJobContext, setResultsJobContext] = useState<ResultsJobContext | null>(null);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  const getLiveInterviewJobs = useCallback((): InterviewJob[] => {
    const liveJobs = getAllStoredJobs(jobs);
    const liveStatuses = getStoredJobStatuses();
    return liveJobs
      .filter((job) => liveStatuses[job.id] === "For Interview")
      .map((job) => ({ id: job.id, title: job.title, company: job.company }));
  }, []);

  const pageContext = getPageContext(pathname);
  const interviewJobs = useMemo<InterviewJob[]>(() => getLiveInterviewJobs(), [getLiveInterviewJobs, statuses]);
  const selectedInterviewJob = interviewJobs.find((job) => job.id === selectedInterviewJobId) ?? null;
  const liveJobsForSelection = useMemo(() => getAllStoredJobs(jobs), [statuses]);
  const selectedJobId =
    pathname.startsWith("/results")
      ? resultsJobContext?.jobId ?? null
      : selectedInterviewJob?.id ?? interviewJobs[0]?.id ?? liveJobsForSelection[0]?.id;
  const computedAnalysesState = getComputedJobAnalysesState();
  const selectedComputedAnalysis = selectedJobId ? computedAnalysesState[selectedJobId] : undefined;
  const selectedAnalysis = selectedJobId
    ? analyses.find((analysis) => analysis.jobId === selectedJobId) ??
      (selectedComputedAnalysis?.analysisState === "ready" ? selectedComputedAnalysis : undefined)
    : undefined;
  const selectedRoleConfidence = deriveConfidenceLevel({
    resumeCompleteness: 0.7,
    strengthCount: selectedAnalysis?.strengths.length ?? 0,
    evidenceItems: selectedAnalysis?.strengths ?? [],
    computedAnalysisState: selectedComputedAnalysis?.analysisState,
    missingEvidenceCount: selectedComputedAnalysis?.missingEvidence.length ?? 0,
  });
  const prompts = useMemo(() => {
    if (!pathname.startsWith("/results")) {
      return getContextualPrompts(pathname);
    }
    return buildResultsPrompts({
      fitScore: selectedAnalysis?.score ?? null,
      confidence: selectedRoleConfidence,
    });
  }, [pathname, selectedAnalysis, selectedRoleConfidence]);

  useEffect(() => {
    if (!pathname.startsWith("/results")) return;

    const syncFromSession = () => {
      const selectedId = getSelectedJobId();
      if (!selectedId) return;

      const liveJobs = getAllStoredJobs(jobs);
      const computedAnalyses = getComputedJobAnalysesState();
      const selectedJob = liveJobs.find((job) => job.id === selectedId);
      const computed = computedAnalyses[selectedId];
      const analysisForJob =
        analyses.find((analysis) => analysis.jobId === selectedId) ??
        (computed?.analysisState === "ready" ? computed : undefined);

      const nextContext: ResultsJobContext = {
        jobId: selectedId ?? null,
        title: selectedJob?.title ?? null,
        company: selectedJob?.company ?? null,
        fitScore: analysisForJob?.score ?? null,
        confidence:
          analysisForJob
            ? deriveConfidenceLevel({
                resumeCompleteness: 0.7,
                strengthCount: analysisForJob.strengths.length,
                evidenceItems: analysisForJob.strengths,
                computedAnalysisState: computed?.analysisState,
                missingEvidenceCount: computed?.missingEvidence.length ?? 0,
              })
            : null,
        gaps: analysisForJob?.gaps.slice(0, 3) ?? [],
      };

      setResultsJobContext((prev) => (sameResultsJobContext(prev, nextContext) ? prev : nextContext));
    };

    syncFromSession();

    const onResultsJobContext = (event: Event) => {
      const nextContext = (event as CustomEvent<ResultsJobContext>).detail;
      setResultsJobContext((prev) => (sameResultsJobContext(prev, nextContext) ? prev : nextContext));
    };

    window.addEventListener("career-coach:results-job-context", onResultsJobContext);
    window.addEventListener("focus", syncFromSession);

    return () => {
      window.removeEventListener("career-coach:results-job-context", onResultsJobContext);
      window.removeEventListener("focus", syncFromSession);
    };
  }, [pathname, selectedJobId]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const getNextGeneralQuestion = useCallback(
    (reset = false): string => {
      const allIndexes = GENERAL_INTERVIEW_QUESTIONS.map((_, index) => index);
      const usedIndexes = reset ? [] : usedGeneralQuestionIndexes;
      const remaining = allIndexes.filter((index) => !usedIndexes.includes(index));
      const pool = remaining.length > 0 ? remaining : allIndexes;
      const nextIndex = pool[Math.floor(Math.random() * pool.length)];
      setUsedGeneralQuestionIndexes((prev) => {
        const base = reset || prev.length >= GENERAL_INTERVIEW_QUESTIONS.length ? [] : prev;
        return [...base, nextIndex];
      });
      return GENERAL_INTERVIEW_QUESTIONS[nextIndex];
    },
    [usedGeneralQuestionIndexes],
  );

  const pushMessages = useCallback(
    (userText: string, responseText: string, actions?: MessageAction[]) => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: userText },
        { id: nextId(), role: "assistant", content: responseText, actions },
      ]);
      setInputValue("");
      scrollToBottom();
    },
    [scrollToBottom],
  );

  const handleFreeformCoachReply = useCallback(
    async (userText: string, normalizedUserText?: string) => {
      const liveJobs = getAllStoredJobs(jobs);
      const liveStatuses = getStoredJobStatuses();
      const liveInterviewJobs = liveJobs
        .filter((job) => liveStatuses[job.id] === "For Interview")
        .map((job) => ({ id: job.id, title: job.title, company: job.company }));
      const liveSelectedInterviewJob =
        liveInterviewJobs.find((job) => job.id === selectedInterviewJobId) ?? null;
      const recentMessages = messages.slice(-4).map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const selectedJobId =
        (pathname.startsWith("/results") ? resultsJobContext?.jobId ?? null : null) ??
        liveSelectedInterviewJob?.id ??
        liveInterviewJobs[0]?.id ??
        liveJobs[0]?.id;
      const selectedJob = selectedJobId ? liveJobs.find((job) => job.id === selectedJobId) : undefined;
      const computedAnalyses = getComputedJobAnalysesState();
      const computedSelected = selectedJobId ? computedAnalyses[selectedJobId] : undefined;
      const selectedAnalysis =
        selectedJobId
          ? analyses.find((analysis) => analysis.jobId === selectedJobId) ??
            (computedSelected?.analysisState === "ready" ? computedSelected : undefined)
          : undefined;
      const selectedOptimize = selectedJobId ? optimizeByJob[selectedJobId] : undefined;
      const selectedJobStatusLabel = computedSelected
        ? computedSelected.analysisState === "insufficient_evidence"
          ? "insufficient-evidence"
          : `fit-ready:${computedSelected.fit}`
        : liveStatuses[selectedJobId ?? ""] ?? "unknown";

      const response = await fetch("/api/coach/freeform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: normalizedUserText ?? userText,
          pageContext: pageContext.label,
          recentMessages: recentMessages.length > 0 ? recentMessages : undefined,
          selectedJobContext: selectedJob
            ? {
                jobId: selectedJob.id,
                title: selectedJob.title,
                company: selectedJob.company,
                status: selectedJobStatusLabel,
              }
            : undefined,
          fitContext:
            pathname.startsWith("/results") && selectedAnalysis
              ? {
                  fit: selectedAnalysis.fit,
                  score: selectedAnalysis.score,
                  topGaps: selectedAnalysis.gaps.slice(0, 2),
                  topStrengths: selectedAnalysis.strengths.slice(0, 2),
                }
              : undefined,
          optimizeContext:
            pathname.startsWith("/optimize") && selectedOptimize
              ? {
                  targetRole: selectedOptimize.targetRole.title,
                  targetCompany: selectedOptimize.targetRole.company,
                  keyChanges: Object.values(selectedOptimize.changes)
                    .map((change) => change.whatChanged)
                    .slice(0, 2),
                  metricPrompts: selectedOptimize.metricInputs.map((m) => m.helpText).slice(0, 2),
                }
              : undefined,
          providerConfig: getProviderConfig(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Freeform request failed (${response.status})`);
      }
      const payload = (await response.json()) as { reply?: string };
      const reply =
        typeof payload.reply === "string" && payload.reply.trim().length > 0
          ? payload.reply
          : FALLBACK_RESPONSE;
      pushMessages(userText, reply);
    },
    [
      interviewJobs,
      messages,
      pageContext.label,
      pathname,
      pushMessages,
      resultsJobContext?.jobId,
      selectedInterviewJobId,
      statuses,
      getLiveInterviewJobs,
    ],
  );

  const getQuestionTypeAwareFeedback = useCallback(
    async (question: string, answer: string): Promise<string> => {
      const userMessage = [
        INTERVIEW_FEEDBACK_SYSTEM_PROMPT,
        "",
        "Interview question:",
        question,
        "",
        "User answer:",
        answer,
      ].join("\n");

      const response = await fetch("/api/coach/freeform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          pageContext: "Interview",
          providerConfig: getProviderConfig(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Interview feedback request failed (${response.status})`);
      }

      const payload = (await response.json()) as { reply?: string };
      if (typeof payload.reply === "string" && payload.reply.trim().length > 0) {
        return payload.reply.trim();
      }
      throw new Error("Interview feedback reply was empty.");
    },
    [],
  );

  const advanceInterviewFlow = useCallback(
    (userText: string) => {
      const interviewJobs = getLiveInterviewJobs();
      const selectedInterviewJob = interviewJobs.find((job) => job.id === selectedInterviewJobId) ?? null;
      if (interviewPhase === "choosing-mode" || !interviewTrack) {
        pushMessages(
          userText,
          "Would you like:\n- General interview practice\n- Role-specific interview prep",
          [
            { id: "mode:general", label: "General interview practice" },
            { id: "mode:role", label: "Role-specific interview prep" },
          ],
        );
        return;
      }

      if (interviewTrack === "role-specific" && !selectedInterviewJob) {
        if (interviewJobs.length === 0) {
          pushMessages(userText, "You don’t have any roles marked as Interview yet.", [
            { id: "mode:general", label: "General interview practice" },
            { id: "mark:interview", label: "Mark a job as Interview" },
          ]);
          return;
        }
        pushMessages(
          userText,
          "Interview-stage roles",
          interviewJobs.map((job) => ({
            id: `role:${job.id}`,
            label: `${job.company} — ${job.title}`,
          })),
        );
        return;
      }

      const nextIndex = questionIndex + 1;
      const prep = selectedInterviewJob ? getInterviewPrepContext(selectedInterviewJob.id) : undefined;
      const nextQuestionText = nextQuestion(interviewTrack, nextIndex, selectedInterviewJob, prep);
      setQuestionIndex(nextIndex);
      setInterviewPhase("active");
      setActiveInterviewQuestion(nextQuestionText);
      pushMessages(
        userText,
        nextQuestionText,
        interviewActions(interviewTrack),
      );
    },
    [
      getLiveInterviewJobs,
      interviewJobs,
      interviewPhase,
      interviewTrack,
      pushMessages,
      questionIndex,
      selectedInterviewJobId,
    ],
  );

  const addExchange = useCallback(
    async (userText: string, promptId?: string) => {
      const interviewJobs = getLiveInterviewJobs();
      const selectedInterviewJob = interviewJobs.find((job) => job.id === selectedInterviewJobId) ?? null;
      if (promptId === "d1") {
        pushMessages(userText, buildPrioritizedRolesResponse());
        return;
      }
      if (promptId === "d3") {
        pushMessages(userText, buildWorkFirstCrossJobResponse());
        return;
      }
      if (promptId && MOCK_RESPONSES[promptId] && !pathname.startsWith("/results")) {
        pushMessages(userText, MOCK_RESPONSES[promptId]);
        return;
      }

      if (pathname.startsWith("/results")) {
        const resultsIntent = classifyResultsIntent(userText);
        if (resultsIntent === "fit_explanation") {
          if (!selectedAnalysis || !selectedJobId) {
            pushMessages(
              userText,
              "I don’t have a current fit read yet. Re-run analysis and I’ll explain your fit, confidence, strengths, and gaps.",
            );
            return;
          }
          const selectedJob = liveJobsForSelection.find((item) => item.id === selectedJobId);
          const roleLabel = buildRoleLabel({
            title: selectedJob?.title,
            company: selectedJob?.company,
          });
          pushMessages(
            userText,
            buildFitExplanationResponse({
              fitScore: selectedAnalysis.score,
              confidence: selectedRoleConfidence,
              strengths: selectedAnalysis.strengths,
              gaps: selectedAnalysis.gaps,
              roleTitle: roleLabel,
            }),
          );
          return;
        }
      }

      if (pathname.startsWith("/results") && classifyResultsIntent(userText) === "decision") {
        if (!selectedAnalysis || !selectedJobId) {
          pushMessages(
            userText,
            "I need a current fit read first. Re-run analysis, then I can give a clear fit-and-confidence recommendation.",
          );
          return;
        }
        const selectedJob = liveJobsForSelection.find((item) => item.id === selectedJobId);
        const roleLabel = buildRoleLabel({
          title: selectedJob?.title,
          company: selectedJob?.company,
        });
        const localDecisionReply = buildFitConfidenceDecisionResponse({
          fitScore: selectedAnalysis.score,
          confidence: selectedRoleConfidence,
          roleLabel,
        });
        const canonicalDecisionPrompt = normalizeDecisionPrompt(userText);
        try {
          await handleFreeformCoachReply(userText, canonicalDecisionPrompt);
        } catch {
          // Silent fallback: always return a useful local recommendation.
          pushMessages(userText, localDecisionReply);
        }
        return;
      }

      if (interviewPhase !== "idle" && isInterviewStartSignal(userText)) {
        if (interviewTrack === "role-specific") {
          if (!selectedInterviewJob) {
            if (interviewJobs.length === 0) {
              pushMessages(userText, "You don’t have any roles marked as Interview yet.", [
                { id: "mode:general", label: "General interview practice" },
                { id: "mark:interview", label: "Mark a job as Interview" },
              ]);
              return;
            }
            setInterviewPhase("choosing-role");
            pushMessages(
              userText,
              "Interview-stage roles",
              interviewJobs.map((job) => ({ id: `role:${job.id}`, label: `${job.company} — ${job.title}` })),
            );
            return;
          }
          setInterviewPhase("active");
          setQuestionIndex(0);
          const firstQuestion = firstRoleInterviewQuestion(
            selectedInterviewJob,
            getInterviewPrepContext(selectedInterviewJob.id),
          );
          setActiveInterviewQuestion(firstQuestion);
          pushMessages(
            userText,
            firstQuestion,
            interviewActions("role-specific"),
          );
          return;
        }

        // Default to general when mode is not selected yet (role-specific is handled above).
        const trackToStart: InterviewTrack = interviewTrack ?? "general";
        setInterviewTrack(trackToStart);
        setInterviewPhase("active");
        setQuestionIndex(0);
        const firstQuestion = getNextGeneralQuestion(true);
        setActiveInterviewQuestion(firstQuestion);
        pushMessages(
          userText,
          firstQuestion,
          interviewActions("general"),
        );
        return;
      }

      if (hasInterviewIntent(userText)) {
        const mentioned = findMentionedJob(userText, interviewJobs);
        const trackFromText = detectTrackFromText(userText);

        if (!trackFromText && !mentioned) {
          setInterviewPhase("choosing-mode");
          pushMessages(userText, "Would you like:\n- General interview practice\n- Role-specific interview prep", [
            { id: "mode:general", label: "General interview practice" },
            { id: "mode:role", label: "Role-specific interview prep" },
          ]);
          return;
        }

        const track = trackFromText ?? "role-specific";
        setInterviewTrack(track);
        setQuestionIndex(0);
        setHasShownFallbackInInterview(false);

        if (track === "role-specific") {
          setInterviewPhase("choosing-role");
          if (interviewJobs.length === 0) {
            pushMessages(userText, "You don’t have any roles marked as Interview yet.", [
              { id: "mode:general", label: "General interview practice" },
              { id: "mark:interview", label: "Mark a job as Interview" },
            ]);
            return;
          }

          if (mentioned) {
            setSelectedInterviewJobId(mentioned.id);
            setInterviewPhase("active");
            const firstQuestion = firstRoleInterviewQuestion(
              mentioned,
              getInterviewPrepContext(mentioned.id),
            );
            setActiveInterviewQuestion(firstQuestion);
            pushMessages(
              userText,
              firstQuestion,
              interviewActions("role-specific"),
            );
            return;
          }

          pushMessages(
            userText,
            "Interview-stage roles",
            interviewJobs.map((job) => ({ id: `role:${job.id}`, label: `${job.company} — ${job.title}` })),
          );
          return;
        }

        setInterviewPhase("active");
        const firstQuestion = getNextGeneralQuestion(true);
        setActiveInterviewQuestion(firstQuestion);
        pushMessages(
          userText,
          firstQuestion,
          interviewActions("general"),
        );
        return;
      }

      if (interviewTrack) {
        if (interviewPhase === "choosing-mode") {
          pushMessages(
            userText,
            "Choose a prep mode first, then say start.",
            [
              { id: "mode:general", label: "General interview practice" },
              { id: "mode:role", label: "Role-specific interview prep" },
            ],
          );
          return;
        }
        if (interviewPhase === "choosing-role" && interviewTrack === "role-specific" && !selectedInterviewJob) {
          if (interviewJobs.length === 0) {
            pushMessages(userText, "You don’t have any roles marked as Interview yet.", [
              { id: "mode:general", label: "General interview practice" },
              { id: "mark:interview", label: "Mark a job as Interview" },
            ]);
            return;
          }
          pushMessages(
            userText,
            "Choose an interview-stage role, then say start.",
            interviewJobs.map((job) => ({ id: `role:${job.id}`, label: `${job.company} — ${job.title}` })),
          );
          return;
        }
        setInterviewPhase("active");
        const { intent, confidence } = classifyInterviewInputIntent(userText);
        const prep = selectedInterviewJob ? getInterviewPrepContext(selectedInterviewJob.id) : undefined;
        const currentQuestion =
          activeInterviewQuestion ??
          nextQuestion(interviewTrack, questionIndex, selectedInterviewJob, prep);

        if (confidence >= 0.4 && confidence < 0.7) {
          pushMessages(
            userText,
            "Looks like you might want to move on or improve your answer — what would you like to do?",
            [
              { id: "mock:clarify-move-on", label: "Move on" },
              { id: "mock:clarify-improve", label: "Improve answer" },
            ],
          );
          return;
        }

        const resolvedIntent: InterviewInputIntent = confidence < 0.4 ? "answer" : intent;

        if (resolvedIntent === "decision_should") {
          const answerForDecision = lastAnswer.trim();
          if (!answerForDecision) {
            pushMessages(
              userText,
              "I can give a decision once you share a draft answer. Send 3-5 sentences, then ask again.",
              interviewActions(interviewTrack),
            );
            return;
          }
          pushMessages(
            userText,
            buildDecisionShouldResponse(answerForDecision),
            interviewActions(interviewTrack),
          );
          return;
        }

        if (resolvedIntent === "decision_when") {
          const answerForDecision = lastAnswer.trim();
          if (!answerForDecision) {
            pushMessages(
              userText,
              "I can set a clear move-on threshold after you share a draft answer. Send it and I’ll define the cutoff.",
              interviewActions(interviewTrack),
            );
            return;
          }
          pushMessages(
            userText,
            buildDecisionWhenResponse(answerForDecision),
            interviewActions(interviewTrack),
          );
          return;
        }

        if (resolvedIntent === "move_on") {
          const nextIndex = questionIndex + 1;
          const nextQuestionText =
            interviewTrack === "general"
              ? getNextGeneralQuestion()
              : nextQuestion(interviewTrack, nextIndex, selectedInterviewJob, prep);
          setQuestionIndex(nextIndex);
          setActiveInterviewQuestion(nextQuestionText);
          pushMessages(
            userText,
            `Got it — let’s move on.\n\n${nextQuestionText}`,
            interviewActions(interviewTrack),
          );
          return;
        }

        if (resolvedIntent === "meta_what") {
          pushMessages(
            userText,
            `${buildMetaWhatResponse(userText)}\n\nIf you want, I can also give you a quick example answer.`,
            interviewActions(interviewTrack),
          );
          return;
        }

        if (resolvedIntent === "meta_why") {
          pushMessages(
            userText,
            `${buildMetaWhyResponse(currentQuestion)}\n\nIf you want, send your draft answer next and I’ll coach it.`,
            interviewActions(interviewTrack),
          );
          return;
        }

        if (resolvedIntent === "help") {
          pushMessages(
            userText,
            `${buildInterviewHelpGuidance(currentQuestion)}\n\nTry your answer and I’ll give feedback.`,
            interviewActions(interviewTrack),
          );
          return;
        }

        if (resolvedIntent === "unsure") {
          pushMessages(
            userText,
            `${buildWeakUnsureGuidance(currentQuestion)}\n\nGive it a try in a few lines, and I’ll coach the next draft.`,
            interviewActions(interviewTrack),
          );
          return;
        }

        setLastAnswer(userText);
        const feedbackQuestion = currentQuestion;
        let feedback: string;
        try {
          feedback = await getQuestionTypeAwareFeedback(feedbackQuestion, userText);
        } catch {
          feedback = buildInterviewFeedback(feedbackQuestion, userText);
        }
        const answerQuality = classifyInterviewAnswerQuality(userText);
        const followUpPrompt =
          answerQuality === "strong"
            ? "Great progress. If you're ready, click Next question. Or revise once more for a final polish."
            : "Revise this answer and send it again. When you're ready to move on, click Next question.";
        pushMessages(
          userText,
          `${feedback}\n\n${followUpPrompt}`,
          interviewActions(interviewTrack),
        );
        return;
      }

      if (interviewPhase !== "idle") {
        if (hasShownFallbackInInterview) {
          advanceInterviewFlow(userText);
          return;
        }
        setHasShownFallbackInInterview(true);
        pushMessages(
          userText,
          "Say “start” and I’ll begin with the first interview question.",
        );
        return;
      }

      if (isUnclearFreeformInput(userText)) {
        const fallbackMessage =
          UNCLEAR_INPUT_FALLBACKS[freeformFallbackCount % UNCLEAR_INPUT_FALLBACKS.length];
        setFreeformFallbackCount((count) => count + 1);
        pushMessages(userText, fallbackMessage);
        return;
      }

      try {
        await handleFreeformCoachReply(userText);
        setFreeformFallbackCount(0);
      } catch {
        // Never expose internal provider errors; return useful local guidance.
        if (pathname.startsWith("/results") && selectedAnalysis && selectedJobId) {
          const selectedJob = liveJobsForSelection.find((item) => item.id === selectedJobId);
          const roleLabel = buildRoleLabel({
            title: selectedJob?.title,
            company: selectedJob?.company,
          });
          pushMessages(
            userText,
            buildLocalResultsFallbackResponse({
              userText,
              roleLabel,
              analysis: selectedAnalysis,
              confidence: selectedRoleConfidence,
            }),
          );
          return;
        }
        const bestLocalPrompt =
          prompts[0]?.label ??
          "Share one target: fit check, decision to apply, or an interview answer draft.";
        pushMessages(
          userText,
          `Let’s keep momentum. ${bestLocalPrompt}`,
        );
      }
    },
    [
      advanceInterviewFlow,
      getLiveInterviewJobs,
      getNextGeneralQuestion,
      getQuestionTypeAwareFeedback,
      handleFreeformCoachReply,
      hasShownFallbackInInterview,
      interviewJobs,
      interviewPhase,
      interviewTrack,
      freeformFallbackCount,
      activeInterviewQuestion,
      pushMessages,
      questionIndex,
      selectedInterviewJobId,
    ],
  );

  const handleAction = useCallback(
    (actionId: string, actionLabel: string) => {
      const interviewJobs = getLiveInterviewJobs();
      const selectedInterviewJob = interviewJobs.find((job) => job.id === selectedInterviewJobId) ?? null;
      if (actionId === "mode:general" || actionId === "mock:switch-general") {
        setInterviewTrack("general");
        setInterviewPhase("ready");
        setQuestionIndex(0);
        setHasShownFallbackInInterview(false);
        const firstQuestion = getNextGeneralQuestion(true);
        setActiveInterviewQuestion(firstQuestion);
        pushMessages(
          actionLabel,
          firstQuestion,
          interviewActions("general"),
        );
        return;
      }
      if (actionId === "mode:role" || actionId === "mock:switch-role") {
        setInterviewTrack("role-specific");
        setInterviewPhase("choosing-role");
        setQuestionIndex(0);
        setHasShownFallbackInInterview(false);
        setActiveInterviewQuestion(null);
        if (interviewJobs.length === 0) {
          pushMessages(actionLabel, buildRoleSpecificPrepMessage(interviewJobs), [
            { id: "mode:general", label: "General interview practice" },
            { id: "mark:interview", label: "Mark a job as Interview" },
          ]);
          return;
        }
        pushMessages(
          actionLabel,
          buildRoleSpecificPrepMessage(interviewJobs),
          interviewJobs.map((job) => ({ id: `role:${job.id}`, label: `${job.company} — ${job.title}` })),
        );
        return;
      }
      if (actionId.startsWith("role:")) {
        const jobId = actionId.replace("role:", "");
        const job = interviewJobs.find((item) => item.id === jobId);
        if (!job) return;
        setSelectedInterviewJobId(job.id);
        setInterviewTrack("role-specific");
        setInterviewPhase("active");
        setQuestionIndex(0);
        setHasShownFallbackInInterview(false);
        const firstQuestion = firstRoleInterviewQuestion(job, getInterviewPrepContext(job.id));
        setActiveInterviewQuestion(firstQuestion);
        const selectionMessage = `Prepare me for the ${job.company} ${job.title} role`;
        pushMessages(
          selectionMessage,
          firstQuestion,
          interviewActions("role-specific"),
        );
        return;
      }
      if (actionId === "mock:next" || actionId === "mock:harder" || actionId === "mock:clarify-move-on") {
        if (!interviewTrack) return;
        const nextIndex = questionIndex + 1;
        const prep = selectedInterviewJob ? getInterviewPrepContext(selectedInterviewJob.id) : undefined;
        const nextQuestionText =
          interviewTrack === "general"
            ? getNextGeneralQuestion()
            : nextQuestion(interviewTrack, nextIndex, selectedInterviewJob, prep);
        setQuestionIndex(nextIndex);
        setActiveInterviewQuestion(nextQuestionText);
        pushMessages(actionLabel, nextQuestionText, interviewActions(interviewTrack));
        return;
      }
      if (actionId === "mock:clarify-improve") {
        if (!interviewTrack) return;
        pushMessages(
          actionLabel,
          "Perfect - send a revised answer and I’ll coach the next draft.",
          interviewActions(interviewTrack),
        );
        return;
      }
      if (actionId === "mark:interview") {
        pushMessages(actionLabel, "Update a role to Interview in Dashboard, then ask me again.");
      }
    },
    [
      getLiveInterviewJobs,
      getNextGeneralQuestion,
      interviewJobs,
      interviewTrack,
      lastAnswer,
      activeInterviewQuestion,
      pushMessages,
      questionIndex,
      selectedInterviewJobId,
    ],
  );

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    void addExchange(text);
  }

  useEffect(() => {
    const refreshState = () => {
      setStatuses(getStoredJobStatuses());
    };
    const onStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === "career-coach.job-statuses" ||
        event.key === "career-coach.user-jobs"
      ) {
        refreshState();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshState();
    };
    refreshState();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshState);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshState);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    function onAsk(e: Event) {
      const prompt = (e as CustomEvent).detail?.prompt;
      if (typeof prompt === "string" && prompt.length > 0) {
        setInputValue(prompt);
        setIsOpen(true);
      }
    }
    window.addEventListener("chris:ask", onAsk);
    return () => window.removeEventListener("chris:ask", onAsk);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const hasMessages = messages.length > 0;
  const canSend = inputValue.trim().length > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Ask Chris"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-zinc-200/60 bg-white px-4 py-2.5 text-[13px] font-medium text-zinc-700 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
          isOpen ? "pointer-events-none scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">C</span>
        Ask Chris
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/20 transition-opacity duration-300 opacity-100"
            onClick={() => setIsOpen(false)}
            onKeyDown={() => {}}
            role="presentation"
          />

          <aside
            className="absolute flex flex-col bg-white will-change-transform
            inset-x-0 bottom-0 h-[80vh] rounded-t-2xl shadow-2xl
            lg:inset-x-auto lg:right-0 lg:top-0 lg:h-full lg:w-[380px] lg:rounded-none lg:border-l lg:border-zinc-200 lg:shadow-xl
            transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] translate-y-0 lg:translate-x-0"
          >
          <div className="flex justify-center pb-1 pt-3 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-zinc-300/80" />
          </div>

          <div className="flex items-center justify-between border-b border-zinc-100 px-5 pb-3 pt-3 lg:pt-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">C</span>
              <h2 className="text-sm font-semibold text-zinc-900">Chris</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">{pageContext.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {showClearConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setInputValue("");
                      setInterviewTrack(null);
                      setInterviewPhase("idle");
                      setQuestionIndex(0);
                      setLastAnswer("");
                      setActiveInterviewQuestion(null);
                      setHasShownFallbackInInterview(false);
                      setShowClearConfirm(false);
                    }}
                    className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white hover:bg-zinc-800"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500 hover:bg-zinc-50"
                >
                  Clear chat
                </button>
              )}
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setIsOpen(false)}
                className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
            <p className="text-[12px] leading-relaxed text-zinc-400">Reviewing {pageContext.hint}.</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void addExchange(p.label, p.id);
                  }}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] leading-snug text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {!hasMessages && (
              <div className="mt-10 flex flex-col items-center gap-1.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-[12px] font-semibold text-zinc-400">C</span>
                <p className="text-[11px] text-zinc-300">Select a prompt or type a question.</p>
              </div>
            )}

            {hasMessages && (
              <div className="mt-6 space-y-4">
                {messages.map((msg) =>
                  msg.role === "assistant" ? (
                    <div key={msg.id} className="flex gap-2.5">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-semibold text-white">C</span>
                      <div className="min-w-0 max-w-[85%]">
                        <div className="rounded-2xl rounded-tl-md bg-zinc-50 px-4 py-3 text-[13px] leading-relaxed text-zinc-700">{renderContent(msg.content)}</div>
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                            {msg.actions.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => handleAction(a.id, a.label)}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-zinc-900 px-4 py-3 text-[13px] leading-relaxed text-white">
                      {msg.content}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder="Ask Chris..."
                className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-colors hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          </aside>
        </div>
      )}
    </>
  );
}
