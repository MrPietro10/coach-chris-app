"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAnalysisInputFingerprint } from "@/lib/analysis-input-fingerprint";
import {
  buildAnalysisResumeContext,
  hasAnalysisResumeContext,
} from "@/lib/analysis-resume-context";
import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PageHeader } from "@/components/ui/page-header";
import { getProviderConfig } from "@/lib/ai";
import {
  getComputedJobAnalysesState,
  getAllStoredJobs,
  getAnalyzedJobsState,
  getStoredResumeInput,
  getSelectedJobId,
  clearPendingAnalysisJobId,
  getPendingAnalysisJobId,
  setComputedJobAnalysis,
  setJobAnalyzed,
  setSelectedJobId as persistSelectedJobId,
  type AnalyzedJobsState,
  type ComputedJobAnalysis,
  type ComputedJobAnalysesState,
} from "@/lib/job-session-store";
import {
  analyses,
  currentResume,
  getStoredJobStatuses,
  jobs,
  optimizeByJob,
  profile,
  setStoredJobStatus,
} from "@/mock-data/career-coach";
import { AskChrisLink } from "@/components/ui/ask-chris-link";
import { InlineOptimizeForJob, type GapDrivenInput } from "@/components/optimize/inline-optimize";
import { logEvent } from "@/lib/alpha-usage-logger";
import {
  confidenceToAxisPercent,
  explainConfidenceLevel,
  fitColor,
  fitScoreToAxisPercent,
  fitVerdict,
  getFitBand,
  getFitMeta,
  getStoredOrInferredConfidence,
  inferConfidenceLevel,
} from "@/utils/fit";
import type { ConfidenceLevel, FitCategory, JobAnalysis, JobPosting } from "@/types/coach";
import type { OptimizeDocument } from "@/types/coach";
import type { AnalyzeSelectedJobOutput } from "@/lib/ai";

function getMatrixPosition(
  score: number,
  confidence: ConfidenceLevel,
  stackIndex: number,
): { x: number; y: number } {
  const baseX = confidenceToAxisPercent(confidence);
  const baseY = fitScoreToAxisPercent(score);
  const offsets = [
    { dx: 0, dy: 0 },
    { dx: -4, dy: 3 },
    { dx: 4, dy: -3 },
    { dx: -6, dy: -2 },
    { dx: 6, dy: 2 },
  ];
  const off = offsets[stackIndex % offsets.length];

  return {
    x: Math.max(6, Math.min(94, baseX + off.dx)),
    y: Math.max(6, Math.min(94, baseY + off.dy)),
  };
}

function getFitBandChipClass(score: number): string {
  const band = getFitBand(score);
  if (band === "High") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (band === "Medium") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-rose-300 bg-rose-50 text-rose-800";
}

function FitMatrix({
  items,
  selectedJobId,
  onSelect,
}: {
  items: { analysis: JobAnalysis; company: string; confidence: ConfidenceLevel }[];
  selectedJobId: string;
  onSelect: (id: string) => void;
}) {
  const laneCounters: Record<string, number> = {};
  const positioned = items.map(({ analysis, company, confidence }) => {
    const laneKey = `${confidence}-${getFitBand(analysis.score)}`;
    const idx = laneCounters[laneKey] ?? 0;
    laneCounters[laneKey] = idx + 1;
    const pos = getMatrixPosition(analysis.score, confidence, idx);
    return { analysis, company, confidence, pos };
  });

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
      <h3 className="text-sm font-medium text-zinc-900">
        Application summary
      </h3>
      <p className="mt-1 text-xs text-zinc-400">
        Fit strength rises on the chart; confidence moves left to right.
      </p>

      <div className="mt-4 flex items-center justify-center">
        <div className="relative w-full max-w-md">
          <span className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[10px] font-medium tracking-wide text-zinc-400">
            Fit strength
          </span>

          {/* Grid container */}
          <div className="relative ml-2 aspect-square w-full overflow-hidden rounded-lg border border-zinc-200">
            <div className="absolute inset-0 grid grid-rows-3">
              <div className="relative bg-emerald-50/35">
                <span className="absolute left-2 top-1.5 text-[10px] font-medium text-zinc-500">
                  High fit
                </span>
              </div>
              <div className="relative bg-sky-50/35">
                <span className="absolute left-2 top-1.5 text-[10px] font-medium text-zinc-500">
                  Medium fit
                </span>
              </div>
              <div className="relative bg-rose-50/35">
                <span className="absolute left-2 top-1.5 text-[10px] font-medium text-zinc-500">
                  Low fit
                </span>
              </div>
            </div>

            <div className="absolute left-0 top-1/3 h-px w-full border-t border-dashed border-zinc-300" />
            <div className="absolute left-0 top-2/3 h-px w-full border-t border-dashed border-zinc-300" />
            <div className="absolute left-1/3 top-0 h-full w-px border-l border-dashed border-zinc-300" />
            <div className="absolute left-2/3 top-0 h-full w-px border-l border-dashed border-zinc-300" />

            <span className="absolute bottom-1 left-1 text-[9px] text-zinc-400">Low confidence</span>
            <span className="absolute bottom-1 right-1 text-[9px] text-zinc-400">High confidence</span>

            {positioned.map(({ analysis, company, confidence, pos }) => {
              const isSelected = analysis.jobId === selectedJobId;
              const fitBand = getFitBand(analysis.score);
              return (
                <button
                  key={analysis.jobId}
                  type="button"
                  onClick={() => onSelect(analysis.jobId)}
                  className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-md scale-110"
                      : `${getFitBandChipClass(analysis.score)} hover:shadow-sm`
                  }`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  title={`${fitBand} fit, ${confidence} confidence`}
                >
                  {company}
                  <span className="ml-1 opacity-70">{analysis.score}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-1.5 text-center text-[10px] font-medium tracking-wide text-zinc-400">
            Confidence
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-zinc-100 pt-3">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          High fit
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          Medium fit
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
          Low fit
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-400" />
          Left = lower confidence
        </span>
      </div>
    </section>
  );
}

function ScoreRing({ score, fit }: { score: number; fit: FitCategory }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const strokeColor: Record<FitCategory, string> = {
    "Strong Fit": "#059669",
    "Backup Fit": "#0284c7",
    "Aspirational Fit": "#d97706",
    "Low Fit": "#e11d48",
  };

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth="5"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={strokeColor[fit]}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xl font-semibold text-zinc-900">
        {score}
      </span>
    </div>
  );
}

function highlightMetricPlaceholders(text: string) {
  const parts = text.split(/(ADD METRIC:[^—]*?)(?=\s*$|—)/);
  return parts.map((part, i) => {
    if (part.startsWith("ADD METRIC:")) {
      return (
        <strong key={i} className="font-semibold text-amber-700">
          {part}
        </strong>
      );
    }
    return part;
  });
}

function inferComputedFitLabel(payload: AnalyzeSelectedJobOutput): FitCategory | null {
  const fitBand = getFitBand(payload.fitScore);
  if (fitBand === "High") return "Strong Fit";
  if (fitBand === "Medium") return "Backup Fit";
  return "Low Fit";
}

function toComputedJobAnalysis(
  jobId: string,
  payload: AnalyzeSelectedJobOutput,
): ComputedJobAnalysis {
  const inferredFit = inferComputedFitLabel(payload);
  const combinedSignals = [...payload.topGaps, ...payload.missingEvidence, payload.overallFitSummary]
    .join(" ")
    .toLowerCase();
  const isUnavailableResponse =
    payload.fitScore <= 1 && combinedSignals.includes("gemini_api_key");
  const hasInsufficientEvidence = isUnavailableResponse;
  const fit = inferredFit ?? "Low Fit";
  const score = payload.fitScore;
  return {
    jobId,
    fit,
    score,
    strengths: payload.topStrengths.slice(0, 4),
    gaps: payload.topGaps.slice(0, 4),
    hrView: payload.riskAreas.slice(0, 3),
    suggestedEdits: [payload.highestPriorityImprovement].filter((item) => item.trim().length > 0),
    suggestedQuestions: [],
    source: "computed-v1",
    analysisState: hasInsufficientEvidence ? "insufficient_evidence" : "ready",
    missingEvidence: payload.missingEvidence.slice(0, 4),
  };
}

function explainConfidenceChange(options: {
  previousConfidence: ConfidenceLevel;
  nextConfidence: ConfidenceLevel;
  nextAnalysis: ComputedJobAnalysis;
}): string | null {
  if (options.previousConfidence === options.nextConfidence) return null;

  const evidenceLooksConcrete = options.nextAnalysis.strengths.some(
    (line) =>
      /\d/.test(line) ||
      /(increased|reduced|improved|impact|result|outcome)/i.test(line),
  );
  const hasMissingEvidence = options.nextAnalysis.missingEvidence.length > 0;

  if (options.nextConfidence === "High") {
    return "Confidence improved because your resume now shows clearer, measurable impact.";
  }

  if (options.nextConfidence === "Low") {
    return hasMissingEvidence
      ? "Confidence dropped because key evidence is still missing, so the fit read is less certain."
      : "Confidence dropped because the updated evidence is still too general for a reliable fit read.";
  }

  if (options.previousConfidence === "Low") {
    return evidenceLooksConcrete
      ? "Confidence improved because your updates added clearer evidence, but a few gaps still remain."
      : "Confidence improved a bit with your updates, but stronger role-specific evidence would help."
  }

  return "Confidence changed after this re-run because the updated resume evidence shifted how clear your fit appears.";
}

function calculateResumeCompleteness(input: {
  summary: string;
  skills: string;
  highlights: string;
}): number {
  const hasSummary = input.summary.trim().length > 0 ? 1 : 0;
  const hasSkills =
    input.skills
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0).length > 0
      ? 1
      : 0;
  const hasHighlights =
    input.highlights
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0).length > 0
      ? 1
      : 0;

  return (hasSummary + hasSkills + hasHighlights) / 3;
}

type StructuredGap = {
  type: "metric_missing" | "skill_missing" | "evidence_missing";
  description: string;
  affectedSection: "summary" | "skills" | "experience";
};

function classifyStructuredGap(gapText: string): StructuredGap {
  const text = gapText.toLowerCase();
  if (text.includes("metric") || text.includes("quantified") || text.includes("outcome")) {
    return { type: "metric_missing", description: gapText, affectedSection: "experience" };
  }
  if (text.includes("ai") || text.includes("workflow") || text.includes("llm")) {
    return { type: "skill_missing", description: gapText, affectedSection: "summary" };
  }
  if (text.includes("stakeholder") || text.includes("cross-functional") || text.includes("alignment")) {
    return { type: "evidence_missing", description: gapText, affectedSection: "experience" };
  }
  if (text.includes("research") || text.includes("insight") || text.includes("interview")) {
    return { type: "evidence_missing", description: gapText, affectedSection: "experience" };
  }
  if (text.includes("experiment") || text.includes("funnel") || text.includes("conversion") || text.includes("growth")) {
    return { type: "metric_missing", description: gapText, affectedSection: "experience" };
  }
  if (text.includes("api") || text.includes("platform") || text.includes("integration") || text.includes("technical")) {
    return { type: "skill_missing", description: gapText, affectedSection: "skills" };
  }
  if (text.includes("domain") || text.includes("industry") || text.includes("payments")) {
    return { type: "skill_missing", description: gapText, affectedSection: "summary" };
  }
  return { type: "evidence_missing", description: gapText, affectedSection: "experience" };
}

function sanitizeResumeLineForOutput(text: string): string {
  return text
    .replace(/\s*[—-]\s*ADD METRIC:\s*e\.g\.[^.;)]*[.;)]?/gi, "")
    .replace(/\bADD METRIC\b:?/gi, "")
    .replace(/\be\.g\.[^.;)]*[.;)]?/gi, "")
    .replace(/\badd metric here\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function resolveInitialSelectedJobId(
  availableJobs: JobPosting[],
  analyzedJobsState: AnalyzedJobsState,
  computedAnalysesState: ComputedJobAnalysesState,
): string {
  const selectedFromSession = getSelectedJobId();
  if (selectedFromSession && availableJobs.some((jobItem) => jobItem.id === selectedFromSession)) {
    return selectedFromSession;
  }

  for (const jobItem of availableJobs) {
    const computed = computedAnalysesState[jobItem.id];
    if (computed?.analysisState === "ready" || analyzedJobsState[jobItem.id]) {
      return jobItem.id;
    }
  }

  return availableJobs[0]?.id ?? analyses[0]?.jobId ?? "";
}

function buildFitSummaryHeadline(options: {
  score: number;
  fitBand: ReturnType<typeof getFitBand>;
  confidenceLevel: ConfidenceLevel;
  verdict: string;
}): string {
  return `Score ${options.score}: ${options.fitBand.toLowerCase()} fit with ${options.confidenceLevel.toLowerCase()} confidence. ${options.verdict}.`;
}

function getProviderUnavailableMessage(payload: AnalyzeSelectedJobOutput): string | null {
  const combined = [
    payload.overallFitSummary,
    ...payload.topGaps,
    ...payload.riskAreas,
    ...payload.missingEvidence,
  ]
    .join(" ")
    .toLowerCase();
  if (!combined.includes("gemini_api_key")) return null;
  return "Live analysis is unavailable right now because Gemini is not configured on the server. Add a valid GEMINI_API_KEY to run job analysis.";
}

export default function ResultsPage() {
  const [mounted, setMounted] = useState(false);
  const [availableJobs, setAvailableJobs] = useState(jobs);
  const [analyzedJobsState, setAnalyzedJobsState] = useState<AnalyzedJobsState>({});
  const [computedAnalysesState, setComputedAnalysesState] = useState<ComputedJobAnalysesState>({});
  const [selectedJobId, setSelectedJobId] = useState(() => analyses[0]?.jobId ?? "");
  const [singleJobUnavailableMessage, setSingleJobUnavailableMessage] = useState<string | null>(null);
  const [singleJobError, setSingleJobError] = useState<string | null>(null);
  const [singleJobContextNotice, setSingleJobContextNotice] = useState<string | null>(null);
  const [isGeneratingSingleJobAnalysis, setIsGeneratingSingleJobAnalysis] = useState(false);
  const [resumeSummaryInput, setResumeSummaryInput] = useState(currentResume.summary);
  const [resumeSkillsInput, setResumeSkillsInput] = useState(currentResume.skills.join(", "));
  const [resumeHighlightsInput, setResumeHighlightsInput] = useState(
    currentResume.experience.flatMap((item) => item.highlights).join("\n"),
  );
  const [copyResumeNotice, setCopyResumeNotice] = useState<string | null>(null);
  const [showInlineOptimize, setShowInlineOptimize] = useState(false);
  const optimizeRef = useRef<HTMLElement | null>(null);
  const [structuredGapsByJob, setStructuredGapsByJob] = useState<Record<string, StructuredGap[]>>({});
  const autoAnalysisStartedForJobRef = useRef<string | null>(null);
  const hasResumeInput =
    resumeSummaryInput.trim().length > 0 ||
    resumeSkillsInput.trim().length > 0 ||
    resumeHighlightsInput.trim().length > 0;

  const computedAnalysis = computedAnalysesState[selectedJobId];
  const analysis = getReadyAnalysisForJob(selectedJobId, computedAnalysesState, analyses);
  const job = availableJobs.find((j) => j.id === selectedJobId);
  const hasReadyFitAnalysis = Boolean(analysis);
  const needsLegacyReanalysis = Boolean(
    job && analyzedJobsState[selectedJobId] && !hasReadyFitAnalysis,
  );
  const hasJobSelected = Boolean(job);
  const optimizeData = job ? optimizeByJob[job.id] : undefined;
  const meta = analysis ? getFitMeta(analysis.fit) : null;
  const verdict = analysis ? fitVerdict(analysis.fit) : null;
  const fitBand = analysis ? getFitBand(analysis.score) : null;
  const topPriorityNextStep = analysis?.gaps[0] ?? "Run analysis after updating one role-relevant proof point.";
  const resumeCompleteness = calculateResumeCompleteness({
    summary: resumeSummaryInput,
    skills: resumeSkillsInput,
    highlights: resumeHighlightsInput,
  });
  const confidenceLevel: ConfidenceLevel = getStoredOrInferredConfidence({
    storedConfidence: computedAnalysis?.confidenceLevel,
    resumeCompleteness,
    missingEvidenceCount: computedAnalysis?.missingEvidence.length ?? 0,
    keyRequirementEvidenceCount: analysis?.strengths.length ?? 0,
    evidenceItems: analysis?.strengths ?? [],
  });
  const confidenceExplanation = analysis
    ? explainConfidenceLevel({
        confidence: confidenceLevel,
        missingEvidenceCount: computedAnalysis?.missingEvidence.length ?? 0,
        keyRequirementEvidenceCount: analysis.strengths.length,
      })
    : null;

  const matrixAnalysisItems = availableJobs
    .map((jobItem) => getReadyAnalysisForJob(jobItem.id, computedAnalysesState, analyses))
    .filter((item): item is JobAnalysis => Boolean(item));
  const getConfidenceForMatrixItem = (analysisItem: JobAnalysis): ConfidenceLevel => {
    const computed = computedAnalysesState[analysisItem.jobId];
    return getStoredOrInferredConfidence({
      storedConfidence: computed?.confidenceLevel,
      resumeCompleteness,
      missingEvidenceCount: computed?.missingEvidence.length ?? 0,
      keyRequirementEvidenceCount: analysisItem.strengths.length,
      evidenceItems: analysisItem.strengths,
    });
  };
  const matrixItems = matrixAnalysisItems.map((a) => ({
    analysis: a,
    company: availableJobs.find((j) => j.id === a.jobId)?.company ?? a.jobId,
    confidence: getConfidenceForMatrixItem(a),
  }));
  const selectedJobIndex = availableJobs.findIndex((jobItem) => jobItem.id === selectedJobId);

  function setSelectedJob(id: string) {
    setSelectedJobId(id);
    persistSelectedJobId(id);
  }

  useEffect(() => {
    if (!selectedJobId || !analysis) return;
    setStructuredGapsByJob((prev) => ({
      ...prev,
      [selectedJobId]: analysis.gaps.map(classifyStructuredGap),
    }));
  }, [analysis, selectedJobId]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("career-coach:results-job-context", {
        detail: {
          jobId: job?.id ?? null,
          title: job?.title ?? null,
          company: job?.company ?? null,
          fitScore: analysis?.score ?? null,
          confidence: analysis ? confidenceLevel : null,
          gaps: analysis?.gaps.slice(0, 3) ?? [],
        },
      }),
    );
  }, [analysis, confidenceLevel, job]);

  useEffect(() => {
    const refreshJobs = () => {
      const nextJobs = getAllStoredJobs(jobs);
      const nextAnalyzedJobsState = getAnalyzedJobsState();
      const nextComputedAnalysesState = getComputedJobAnalysesState();
      setAvailableJobs(nextJobs);
      setAnalyzedJobsState(nextAnalyzedJobsState);
      setComputedAnalysesState(nextComputedAnalysesState);
      setSelectedJobId((currentSelectedJobId) => {
        if (nextJobs.some((jobItem) => jobItem.id === currentSelectedJobId)) {
          return currentSelectedJobId;
        }
        const nextSelectedJobId = resolveInitialSelectedJobId(
          nextJobs,
          nextAnalyzedJobsState,
          nextComputedAnalysesState,
        );
        if (nextSelectedJobId) {
          persistSelectedJobId(nextSelectedJobId);
        }
        return nextSelectedJobId;
      });
    };
    const storedResume = getStoredResumeInput();
    if (storedResume.summary || storedResume.skills || storedResume.highlights) {
      setResumeSummaryInput(storedResume.summary);
      setResumeSkillsInput(storedResume.skills);
      setResumeHighlightsInput(storedResume.highlights);
    }
    const nextJobs = getAllStoredJobs(jobs);
    const nextAnalyzedJobsState = getAnalyzedJobsState();
    const nextComputedAnalysesState = getComputedJobAnalysesState();
    setAvailableJobs(nextJobs);
    setAnalyzedJobsState(nextAnalyzedJobsState);
    setComputedAnalysesState(nextComputedAnalysesState);
    const initialSelectedJobId = resolveInitialSelectedJobId(
      nextJobs,
      nextAnalyzedJobsState,
      nextComputedAnalysesState,
    );
    setSelectedJobId(initialSelectedJobId);
    if (initialSelectedJobId) {
      persistSelectedJobId(initialSelectedJobId);
    }
    setMounted(true);
    window.addEventListener("storage", refreshJobs);
    window.addEventListener("focus", refreshJobs);
    window.addEventListener("career-coach:analysis-updated", refreshJobs);
    return () => {
      window.removeEventListener("storage", refreshJobs);
      window.removeEventListener("focus", refreshJobs);
      window.removeEventListener("career-coach:analysis-updated", refreshJobs);
    };
  }, []);

  useEffect(() => {
    setSingleJobUnavailableMessage(null);
    setSingleJobError(null);
    setSingleJobContextNotice(null);
    setShowInlineOptimize(false);
  }, [selectedJobId]);

  const applyOptimizeDocToResumeContext = useCallback((doc: OptimizeDocument) => {
    setResumeSummaryInput(sanitizeResumeLineForOutput(doc.summary ?? ""));
    setResumeSkillsInput(
      (doc.tools ?? [])
        .map((tool) => sanitizeResumeLineForOutput(tool))
        .filter((tool) => tool.length > 0)
        .join(", "),
    );
    const highlights = (doc.experience ?? [])
      .flatMap((entry) => entry.bullets ?? [])
      .map((bullet) => sanitizeResumeLineForOutput(bullet))
      .filter((bullet) => bullet.length > 0);
    setResumeHighlightsInput(highlights.join("\n"));
    setCopyResumeNotice(null);
  }, []);

  const inlineGapInputs = useMemo<GapDrivenInput[]>(() => {
    const structured = structuredGapsByJob[selectedJobId] ?? [];
    return structured.map((gap, index) => ({
      id: `gap-input-${index}`,
      type: gap.type,
      description: gap.description,
      affectedSection: gap.affectedSection,
      label:
        gap.type === "metric_missing"
          ? "Add measurable impact"
          : gap.type === "skill_missing"
          ? "Add missing skill evidence"
          : "Add stronger role evidence",
      helpText:
        gap.affectedSection === "skills"
          ? "Add concise skill evidence that maps to this gap."
          : gap.affectedSection === "summary"
          ? "Add a summary line that directly addresses this gap."
          : "Add specific experience evidence that addresses this gap.",
      placeholder:
        gap.type === "metric_missing"
          ? "Enter a real impact metric"
          : gap.type === "skill_missing"
          ? "Enter missing skill(s) or capability"
          : "Enter role-relevant evidence",
    }));
  }, [selectedJobId, structuredGapsByJob]);

  const generateSingleJobAnalysis = useCallback(async (eventName: "run_analysis" | "rerun_analysis") => {
    if (!job) {
      setSingleJobContextNotice("Select a job to generate single-job analysis.");
      setSingleJobError(null);
      return;
    }
    if (isGeneratingSingleJobAnalysis) return;

    const resumeContext = buildAnalysisResumeContext({
      summary: resumeSummaryInput,
      skills: resumeSkillsInput,
      highlights: resumeHighlightsInput,
    });
    if (!hasAnalysisResumeContext(resumeContext)) {
      setSingleJobError("Paste your resume on the Resume page or in the resume fields below before analyzing.");
      return;
    }

    const inputFingerprint = buildAnalysisInputFingerprint({
      jobId: job.id,
      jobDescription: job.description,
      resumeContext,
    });
    const storedComputed = computedAnalysesState[job.id];
    if (
      storedComputed?.analysisState === "ready" &&
      storedComputed.inputFingerprint === inputFingerprint
    ) {
      setJobAnalyzed(job.id, true);
      setAnalyzedJobsState((prev) => ({ ...prev, [job.id]: true }));
      const currentStatus = getStoredJobStatuses()[job.id];
      if (!currentStatus || currentStatus === "Analyzed") {
        setStoredJobStatus(job.id, "Analyzed");
      }
      setComputedAnalysesState((prev) => ({ ...prev, [job.id]: storedComputed }));
      setSelectedJob(job.id);
      clearPendingAnalysisJobId();
      setSingleJobError(null);
      setSingleJobUnavailableMessage(null);
      if (eventName === "rerun_analysis") {
        setSingleJobContextNotice("Inputs unchanged — showing your saved analysis.");
      } else {
        setSingleJobContextNotice(null);
      }
      window.dispatchEvent(new Event("career-coach:analysis-updated"));
      return;
    }

    logEvent(eventName, { jobTitle: job.title });

    setIsGeneratingSingleJobAnalysis(true);
    setSingleJobError(null);
    setSingleJobContextNotice(null);
    setSingleJobUnavailableMessage(null);
    clearPendingAnalysisJobId();
    const previousConfidence: ConfidenceLevel | null = hasReadyFitAnalysis
      ? getStoredOrInferredConfidence({
          storedConfidence: storedComputed?.confidenceLevel,
          resumeCompleteness,
          missingEvidenceCount: storedComputed?.missingEvidence.length ?? 0,
          keyRequirementEvidenceCount: analysis?.strengths.length ?? 0,
          evidenceItems: analysis?.strengths ?? [],
        })
      : null;
    try {
      const response = await fetch("/api/coach/single-job-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedJob: {
            jobId: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            requiredSkills: job.requiredSkills,
          },
          resumeContext,
          fitContext: analysis
            ? {
                fit: analysis.fit,
                score: analysis.score,
                topStrengths: analysis.strengths.slice(0, 3),
                topGaps: analysis.gaps.slice(0, 3),
              }
            : undefined,
          optimizeContext: optimizeData
            ? {
                targetRole: optimizeData.targetRole.title,
                targetCompany: optimizeData.targetRole.company,
                keyChanges: Object.values(optimizeData.changes)
                  .map((change) => change.whatChanged)
                  .slice(0, 3),
                metricPrompts: optimizeData.metricInputs.map((metric) => metric.helpText).slice(0, 3),
              }
            : undefined,
          providerConfig: getProviderConfig(),
        }),
      });
      if (!response.ok) {
        let errorMessage = "Could not generate analysis right now. Please try again in a moment.";
        try {
          const errorPayload = (await response.json()) as { error?: string };
          if (typeof errorPayload.error === "string" && errorPayload.error.trim().length > 0) {
            errorMessage = errorPayload.error;
          }
        } catch {
          // Keep the default error message when the response body is not JSON.
        }
        setSingleJobError(errorMessage);
        return;
      }
      const payload = (await response.json()) as AnalyzeSelectedJobOutput;
      const unavailableMessage = getProviderUnavailableMessage(payload);
      if (unavailableMessage) {
        setSingleJobUnavailableMessage(unavailableMessage);
        return;
      }
      setJobAnalyzed(job.id, true);
      setAnalyzedJobsState((prev) => ({ ...prev, [job.id]: true }));
      const currentStatus = getStoredJobStatuses()[job.id];
      if (!currentStatus || currentStatus === "Analyzed") {
        setStoredJobStatus(job.id, "Analyzed");
      }
      const computedBase = toComputedJobAnalysis(job.id, payload);
      const nextConfidence = inferConfidenceLevel({
        resumeCompleteness,
        missingEvidenceCount: computedBase.missingEvidence.length,
        keyRequirementEvidenceCount: computedBase.strengths.length,
        evidenceItems: computedBase.strengths,
      });
      const computed: ComputedJobAnalysis = {
        ...computedBase,
        inputFingerprint,
        confidenceLevel: nextConfidence,
      };
      const confidenceChangeMessage =
        previousConfidence === null
          ? null
          : explainConfidenceChange({
              previousConfidence,
              nextConfidence,
              nextAnalysis: computed,
            });
      setComputedJobAnalysis(computed);
      setComputedAnalysesState((prev) => ({ ...prev, [job.id]: computed }));
      setSelectedJob(job.id);
      window.dispatchEvent(new Event("career-coach:analysis-updated"));
      if (confidenceChangeMessage) {
        setSingleJobContextNotice(confidenceChangeMessage);
      }
    } catch (error) {
      console.error("single-job-analysis-error", error);
      setSingleJobError(
        "Could not generate analysis right now. Please try again in a moment.",
      );
    } finally {
      setIsGeneratingSingleJobAnalysis(false);
    }
  }, [
    analysis,
    computedAnalysesState,
    hasReadyFitAnalysis,
    isGeneratingSingleJobAnalysis,
    job,
    optimizeData,
    resumeCompleteness,
    resumeHighlightsInput,
    resumeSkillsInput,
    resumeSummaryInput,
  ]);

  const handleAnalyzeAction = useCallback(
    (forceRerun = false) => {
      void generateSingleJobAnalysis(forceRerun ? "rerun_analysis" : "run_analysis");
    },
    [generateSingleJobAnalysis],
  );

  useEffect(() => {
    if (!mounted || !job || isGeneratingSingleJobAnalysis || hasReadyFitAnalysis) return;

    const pendingJobId = getPendingAnalysisJobId();
    if (!pendingJobId || pendingJobId !== selectedJobId) return;

    const resumeContext = buildAnalysisResumeContext({
      summary: resumeSummaryInput,
      skills: resumeSkillsInput,
      highlights: resumeHighlightsInput,
    });
    if (!hasAnalysisResumeContext(resumeContext)) return;
    if (autoAnalysisStartedForJobRef.current === selectedJobId) return;

    autoAnalysisStartedForJobRef.current = selectedJobId;
    void generateSingleJobAnalysis("run_analysis");
  }, [
    generateSingleJobAnalysis,
    hasReadyFitAnalysis,
    isGeneratingSingleJobAnalysis,
    job,
    mounted,
    resumeHighlightsInput,
    resumeSkillsInput,
    resumeSummaryInput,
    selectedJobId,
  ]);

  function buildResumeExportText(): string {
    const skills = resumeSkillsInput
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const highlights = resumeHighlightsInput
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return [
      profile.fullName?.trim() || "",
      "",
      "SUMMARY",
      resumeSummaryInput.trim() || "(not provided)",
      "",
      "SKILLS",
      skills.length > 0 ? skills.map((item) => `- ${item}`).join("\n") : "- (none)",
      "",
      "EXPERIENCE",
      highlights.length > 0
        ? highlights.map((item) => `- ${item}`).join("\n")
        : "- (none)",
      "",
    ]
      .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
      .join("\n");
  }

  async function exportResumeDocx() {
    const confirmed = window.confirm(
      "Download the updated resume as a .docx file?",
    );
    if (!confirmed) return;
    logEvent("download_resume");

    const skills = resumeSkillsInput
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const highlights = resumeHighlightsInput
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const paragraphs: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: profile.fullName?.trim() || "Resume",
            bold: true,
          }),
        ],
      }),
      new Paragraph(""),
      new Paragraph({ children: [new TextRun({ text: "SUMMARY", bold: true })] }),
      new Paragraph(resumeSummaryInput.trim() || "(not provided)"),
      new Paragraph(""),
      new Paragraph({ children: [new TextRun({ text: "SKILLS", bold: true })] }),
      ...(skills.length > 0
        ? skills.map(
            (item) =>
              new Paragraph({
                text: item,
                bullet: { level: 0 },
              }),
          )
        : [new Paragraph({ text: "(none)", bullet: { level: 0 } })]),
      new Paragraph(""),
      new Paragraph({ children: [new TextRun({ text: "EXPERIENCE", bold: true })] }),
      ...(highlights.length > 0
        ? highlights.map(
            (item) =>
              new Paragraph({
                text: item,
                bullet: { level: 0 },
              }),
          )
        : [new Paragraph({ text: "(none)", bullet: { level: 0 } })]),
    ];

    const resumeDoc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(resumeDoc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resume-context.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyResumeText() {
    try {
      await navigator.clipboard.writeText(buildResumeExportText());
      setCopyResumeNotice("Resume copied.");
    } catch {
      setCopyResumeNotice("Could not copy resume. Please try again.");
    }
  }

  if (!mounted) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Results"
        subtitle="Here's how you match — strengths, gaps, and what to do about them."
      />

      <div className="space-y-5">
        {/* ── 0. Application Summary Matrix ── */}
        <FitMatrix
          items={matrixItems}
          selectedJobId={selectedJobId}
          onSelect={setSelectedJob}
        />
        {job && (
          <section className="rounded-xl border border-zinc-200/80 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-zinc-400">Selected job</p>
                <p className="truncate text-sm font-medium text-zinc-900">
                  {job.title} · {job.company}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedJobIndex <= 0) return;
                    setSelectedJob(availableJobs[selectedJobIndex - 1].id);
                  }}
                  disabled={selectedJobIndex <= 0}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedJobIndex < 0 || selectedJobIndex >= availableJobs.length - 1) return;
                    setSelectedJob(availableJobs[selectedJobIndex + 1].id);
                  }}
                  disabled={selectedJobIndex < 0 || selectedJobIndex >= availableJobs.length - 1}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}
        {job && !hasReadyFitAnalysis && (
          <p className="px-1 text-xs text-zinc-500">
            {computedAnalysis?.analysisState === "insufficient_evidence"
              ? "This job was analyzed but evidence is insufficient for matrix placement yet."
              : "This saved job is not in the matrix yet. Run analysis to place it."}
          </p>
        )}
        {analysis && job && meta && verdict ? (
          <>
            {/* ── 1. Fit Summary ── */}
            <section className="rounded-xl border border-zinc-200/80 bg-white p-6">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                <ScoreRing score={analysis.score} fit={analysis.fit} />
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {job.title}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    {job.company} · {job.location}
                    {job.salaryRange && <span> · {job.salaryRange}</span>}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    {fitBand && (
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${fitColor(analysis.fit)}`}
                        title={meta.description}
                      >
                        Fit: {analysis.score} ({fitBand})
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium text-zinc-600">
                      Confidence: {confidenceLevel}
                    </span>
                    <span className="text-sm text-zinc-600">{verdict}</span>
                  </div>
                  {fitBand && verdict && (
                    <>
                      <p className="mt-2 text-sm text-zinc-700">
                        {buildFitSummaryHeadline({
                          score: analysis.score,
                          fitBand,
                          confidenceLevel,
                          verdict,
                        })}
                      </p>
                      {confidenceExplanation && (
                        <p className="mt-1 text-sm text-zinc-600">{confidenceExplanation}</p>
                      )}
                      <p className="mt-1 text-xs text-zinc-500">
                        Treat this as guidance and focus on filling evidence gaps before making a final decision.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* ── Chris prompts ── */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
              <AskChrisLink
                prompt={`Why is ${job.title} at ${job.company} a ${analysis.fit}?`}
              >
                Why is this a {meta.shortLabel}?
              </AskChrisLink>
              <AskChrisLink
                prompt={`What are my biggest gaps for ${job.title} at ${job.company}?`}
              >
                What are my biggest gaps?
              </AskChrisLink>
              <AskChrisLink
                prompt={`Should I apply to ${job.title} at ${job.company}?`}
              >
                Should I still apply?
              </AskChrisLink>
            </div>

            {/* ── 2. Why This Fit ── */}
            <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
              <h3 className="text-sm font-medium text-zinc-900">Why this fit</h3>
              <ul className="mt-3 space-y-2">
                {analysis.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>

            {/* ── 3. Key Gaps ── */}
            <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
              <h3 className="text-sm font-medium text-zinc-900">Key gaps</h3>
              <p className="mt-1 text-xs text-zinc-400">
                What is missing, why it matters for this role, and how to improve it
              </p>
              <ul className="mt-3 space-y-2">
                {analysis.gaps.map((g) => (
                  <li key={g} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    {highlightMetricPlaceholders(g)}
                  </li>
                ))}
                {analysis.hrView.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-zinc-500">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Top priority next step
                </p>
                <p className="mt-1.5 text-sm text-zinc-700">{topPriorityNextStep}</p>
              </div>
            </section>

          </>
        ) : job && !hasReadyFitAnalysis ? (
          <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
            <h3 className="text-sm font-medium text-zinc-900">{job.title}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {job.company} · {job.location}
              {job.salaryRange && <span> · {job.salaryRange}</span>}
            </p>
            <p className="mt-3 text-sm text-zinc-600">
              {needsLegacyReanalysis
                ? "This job was saved before analysis was stored. Run analysis to get a fit score, confidence, and gaps."
                : computedAnalysis?.analysisState === "insufficient_evidence"
                ? "You might still be a fit, but confidence is low because key evidence is missing."
                : "Run analysis once to get a fit score, confidence, and gaps for this role."}
            </p>
            {computedAnalysis?.missingEvidence && computedAnalysis.missingEvidence.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-600">
                {computedAnalysis.missingEvidence.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => handleAnalyzeAction(false)}
              disabled={isGeneratingSingleJobAnalysis}
              className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingSingleJobAnalysis ? "Analyzing..." : "Analyze selected job fit"}
            </button>
          </section>
        ) : (
          <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
            <h3 className="text-sm font-medium text-zinc-900">Selected job required</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Select one job from the summary above to view details and run single-job analysis.
            </p>
          </section>
        )}

        {/* ── 5. Actions ── */}
        <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
          <h3 className="text-sm font-medium text-zinc-900">What to do next</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Keep the loop tight here: edit your resume for this role, re-run analysis, then decide whether to prioritize it. If core gaps still remain after that, skip this role and focus on stronger matches.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {optimizeData && (
              <button
                type="button"
                onClick={() => {
                  logEvent("improve_resume");
                  setShowInlineOptimize(true);
                  requestAnimationFrame(() => {
                    optimizeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                disabled={isGeneratingSingleJobAnalysis}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Improve resume input
              </button>
            )}
            <button className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
              Skip this role
            </button>
            {job && (
              <AskChrisLink
                prompt={
                  analysis
                    ? `Help me decide whether to apply to ${job.title} at ${job.company}. My fit is ${analysis.fit} with a score of ${analysis.score}.`
                    : `Help me decide whether to apply to ${job.title} at ${job.company}.`
                }
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Ask Chris for advice
              </AskChrisLink>
            )}
            <button
              type="button"
              onClick={() => handleAnalyzeAction(hasReadyFitAnalysis)}
              disabled={isGeneratingSingleJobAnalysis || !hasJobSelected}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingSingleJobAnalysis
                ? "Analyzing selected job fit..."
                : hasReadyFitAnalysis
                  ? "Re-run analysis"
                  : "Analyze selected job fit"}
            </button>
            <button
              type="button"
              onClick={() => {
                void exportResumeDocx();
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Export resume
            </button>
            <button
              type="button"
              onClick={() => {
                void copyResumeText();
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Copy resume
            </button>
          </div>
          {copyResumeNotice && (
            <p className="mt-2 text-xs text-zinc-600">{copyResumeNotice}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Uses the resume you edit on this page for the currently selected role.
          </p>
          {!hasResumeInput && (
            <p className="mt-2 text-xs text-zinc-500">Paste your resume here to begin</p>
          )}
          {singleJobContextNotice && (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              {singleJobContextNotice}
            </p>
          )}
          {isGeneratingSingleJobAnalysis && (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              Analyzing selected job context...
            </p>
          )}
          {singleJobError && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {singleJobError}
            </p>
          )}
        </section>

        {/* ── Inline Optimize (guided metrics + preview) ── */}
        {optimizeData && (
          <section ref={optimizeRef} className="scroll-mt-24">
            {showInlineOptimize ? (
              <InlineOptimizeForJob
                jobData={optimizeData}
                onDocChange={applyOptimizeDocToResumeContext}
                gapInputs={inlineGapInputs}
              />
            ) : null}
          </section>
        )}

        {singleJobUnavailableMessage && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="text-sm font-medium text-amber-900">Live analysis unavailable</h3>
            <p className="mt-1 text-sm text-amber-800">{singleJobUnavailableMessage}</p>
          </section>
        )}

      </div>

      {isGeneratingSingleJobAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-5">
          <section className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg">
            <p className="text-sm font-medium text-zinc-900">Analyzing job fit</p>
            <p className="mt-1 text-sm text-zinc-600">
              {job
                ? `Running analysis for ${job.title} at ${job.company}.`
                : "Running analysis for the selected role."}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              This can take a moment. Analyze and re-run stay disabled until the request finishes.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
