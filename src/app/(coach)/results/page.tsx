"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAnalysisInputFingerprint, buildResumeJobContentFingerprint } from "@/lib/analysis-input-fingerprint";
import { getAnalysisOutputCache, setAnalysisOutputCache } from "@/lib/job-analysis-output-cache";
import { getTailoredDraftOutputCache, setTailoredDraftOutputCache } from "@/lib/job-tailored-draft-output-cache";
import {
  ANALYSIS_PROGRESS_STEPS,
  ANALYSIS_SUCCESS_MESSAGE,
  messageForAnalysisFailureCode,
  type AnalysisFailureCode,
  parseAnalysisFailureResponse,
  toUserFacingAnalysisError,
} from "@/lib/analysis-flow-messages";
import {
  logAnalysisRetryDiagnostic,
  validateAnalysisRequest,
} from "@/lib/analysis-request";
import {
  type AnalysisFeedbackStatus,
} from "@/components/results/analysis-feedback-banner";
import { Step3StatusStrip } from "@/components/results/step3-status-strip";
import { AnalysisFailureModal } from "@/components/results/analysis-failure-modal";
import { TailoredResumeDraftFailureModal } from "@/components/results/tailored-resume-draft-failure-modal";
import { TailoredResumeDraftModal } from "@/components/results/tailored-resume-draft-modal";
import {
  ExportTailoredDraftDialog,
  type TailoredDraftResumeIntent,
} from "@/components/results/export-tailored-draft-dialog";
import { runTailoredResumeDraftWithRetry } from "@/lib/client-run-tailored-resume-draft";
import type { TailoredDraftFailureCode } from "@/lib/tailored-draft-flow-messages";
import {
  ANALYSIS_SNAPSHOT_CONTEXT_NOTICE,
  ANALYSIS_SNAPSHOT_COPY_NOTICE,
  ANALYSIS_SNAPSHOT_EXPORT_NOTICE,
} from "@/lib/analysis-snapshot-messages";
import {
  buildAnalysisResumeSnapshotFromInput,
  enrichComputedJobAnalysisWithResumeLink,
  getAnalysisResumeVersionLabel,
  restoreAnalysisSnapshotAsResumeVersion,
  snapshotToStoredInput,
} from "@/lib/analysis-resume-linkage";
import { getStoredResumeInputForAnalysis } from "@/lib/analysis-resume-selection";
import {
  getResultsResumeLabel,
  resolveResultsDisplayResume,
  resolveResumeForAnalysisRun,
  type ResultsResumeContext,
} from "@/lib/results-resume-context";
import {
  buildAnalysisResumeContext,
  hasAnalysisResumeContext,
} from "@/lib/analysis-resume-context";
import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import { logEvent } from "@/lib/alpha-usage-logger";
import {
  getActiveResumeRecord,
  getLatestTailoredResumeForJob,
  getResumeRecord,
  recordToInput,
  saveResumeDraftForRecord,
  saveResumeInputForRecord,
  type StoredResumeInput,
  type StoredResumeRecord,
} from "@/lib/resume-store";
import {
  buildTailoredResumeVersionName,
  draftFieldsToStoredInput,
  type TailoredResumeDraft,
} from "@/lib/tailored-resume-draft";
import {
  mergeTailoredFieldsWithSource,
  storedInputToDraftFields,
} from "@/lib/tailored-resume-merge";
import {
  buildPendingTailoredDraft,
  clearPendingTailoredDraftForJob,
  getPendingTailoredDraftForJobAndSource,
  getPendingTailoredDraftForJob,
  hasPendingTailoredDraftForJob,
  PENDING_TAILORED_DRAFT_MESSAGE,
  pendingToTailoredDraft,
  savePendingTailoredDraft,
} from "@/lib/pending-tailored-drafts";
import { resolveResultsExport, type ResultsExportResolution } from "@/lib/results-export-context";
import {
  buildResumeExportNotice,
  buildResumeExportPlainText,
  downloadResumeExport,
} from "@/lib/resume-export";
import { KeyGapsList } from "@/components/results/key-gaps-list";
import { JobApplicationTracking } from "@/components/jobs/job-application-tracking";
import { ClearAllJobsConfirmDialog } from "@/components/jobs/clear-all-jobs-confirm-dialog";
import { RemoveJobConfirmDialog } from "@/components/jobs/remove-job-confirm-dialog";
import { CoachChrisIntro } from "@/components/onboarding/coach-chris-intro";
import { PageHeader } from "@/components/ui/page-header";
import { getProviderConfig } from "@/lib/ai";
import {
  getComputedJobAnalysesState,
  clearAllUserJobs,
  createTailoredResumeVersion,
  deleteUserJob,
  getAllStoredJobs,
  getAnalyzedJobsState,
  getStoredUserJobs,
  getResumeParsedAt,
  getResumePersistenceState,
  getResumeSavedAt,
  getStoredProfile,
  getStoredResumeInput,
  getStoredResumeUploadState,
  getSelectedJobId,
  RESUME_STORAGE_CHANGED_EVENT,
  saveStoredResumeDraft,
  saveStoredResumeInput,
  clearPendingAnalysisContext,
  clearSelectedJobId,
  getPendingAnalysisContext,
  getPendingAnalysisJobId,
  getPendingAnalysisResumeId,
  markPendingAnalysisContext,
  setComputedJobAnalysis,
  setJobAnalyzed,
  setSelectedJobId as persistSelectedJobId,
  type AnalyzedJobsState,
  type ComputedJobAnalysis,
  type ComputedJobAnalysesState,
} from "@/lib/job-session-store";
import { JOB_PIPELINE_UPDATED_EVENT } from "@/lib/job-pipeline-store";
import {
  analyses,
  currentResume,
  getStoredJobStatuses,
  jobs,
  optimizeByJob,
  profile,
  setStoredJobStatus,
} from "@/mock-data/career-coach";
import { JobActiveBadge } from "@/components/jobs/job-active-badge";
import { AskChrisLink } from "@/components/ui/ask-chris-link";
import { InlineOptimizeForJob, type GapDrivenInput } from "@/components/optimize/inline-optimize";
import {
  buildFitSummaryLine,
  confidenceToAxisPercent,
  EVIDENCE_STRENGTH_DISCLAIMER,
  explainEvidenceStrengthChange,
  fitColor,
  fitScoreToAxisPercent,
  formatEvidenceStrengthShort,
  getEncouragingEvidenceInsight,
  getFitBand,
  getFitMeta,
  getStoredOrInferredConfidence,
  inferConfidenceLevel,
} from "@/utils/fit";
import type { ConfidenceLevel, FitCategory, JobAnalysis, JobPosting, JobStatus, JobStatusMap } from "@/types/coach";
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

const PRIMARY_DRIVER_STRENGTH_PATTERN = /^primary driver\b/i;
const HR_SOFT_GAP_PATTERN = /^experience depth is solid\b/i;
const TOP_GAP_INJECTED_PATTERN = /^top gap to address\b/i;

function partitionResultsBullets(analysis: JobAnalysis): {
  alignmentStrengths: string[];
  resumeGaps: string[];
  coachesContext: string[];
} {
  const movedFromStrengths: string[] = [];
  const alignmentStrengths: string[] = [];

  for (const item of analysis.strengths) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (PRIMARY_DRIVER_STRENGTH_PATTERN.test(trimmed)) {
      movedFromStrengths.push(
        trimmed.replace(/^primary driver( to improve)?:\s*/i, "").trim() || trimmed,
      );
      continue;
    }
    if (HR_SOFT_GAP_PATTERN.test(trimmed)) {
      movedFromStrengths.push(trimmed);
      continue;
    }
    alignmentStrengths.push(trimmed);
  }

  const resumeGaps = [
    ...movedFromStrengths,
    ...analysis.gaps.map((g) => g.trim()).filter(Boolean),
  ].filter((gap) => !TOP_GAP_INJECTED_PATTERN.test(gap));

  return {
    alignmentStrengths,
    resumeGaps,
    coachesContext: analysis.hrView.map((h) => h.trim()).filter(Boolean),
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
  selectionDisabled = false,
}: {
  items: { analysis: JobAnalysis; company: string; confidence: ConfidenceLevel }[];
  selectedJobId: string;
  onSelect: (id: string) => void;
  selectionDisabled?: boolean;
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
        Fit strength is vertical (primary). Evidence strength moves left to right and reflects resume proof—not how good you are.
        Click a dot to switch the active job.
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

            <span className="absolute bottom-1 left-1 text-[9px] text-zinc-400">Less evidence</span>
            <span className="absolute bottom-1 right-1 text-[9px] text-zinc-400">More evidence</span>

            {positioned.map(({ analysis, company, confidence, pos }) => {
              const isSelected = analysis.jobId === selectedJobId;
              const fitBand = getFitBand(analysis.score);
              return (
                <button
                  key={analysis.jobId}
                  type="button"
                  disabled={selectionDisabled}
                  onClick={() => onSelect(analysis.jobId)}
                  className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-md scale-110"
                      : `${getFitBandChipClass(analysis.score)} hover:shadow-sm`
                  }`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  title={`${fitBand} fit · ${formatEvidenceStrengthShort(confidence)}`}
                >
                  {company}
                  <span className="ml-1 opacity-70">{analysis.score}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-1.5 text-center text-[10px] font-medium tracking-wide text-zinc-400">
            Evidence strength
          </p>
        </div>
      </div>

    </section>
  );
}

/** Compact fit indicator — score is secondary to category and narrative. */
function CompactFitMeter({ score, fit }: { score: number; fit: FitCategory }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const strokeColor: Record<FitCategory, string> = {
    "Strong Fit": "#059669",
    "Backup Fit": "#0284c7",
    "Aspirational Fit": "#d97706",
    "Low Fit": "#e11d48",
  };

  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center"
      title={`Fit score ${score} — use strengths and gaps below to decide next steps`}
    >
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e4e4e7" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={strokeColor[fit]}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-semibold text-zinc-700">{score}</span>
    </div>
  );
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
  const evidenceLooksConcrete = options.nextAnalysis.strengths.some(
    (line) =>
      /\d/.test(line) ||
      /(increased|reduced|improved|impact|result|outcome)/i.test(line),
  );
  const hasMissingEvidence = options.nextAnalysis.missingEvidence.length > 0;

  return explainEvidenceStrengthChange({
    previousLevel: options.previousConfidence,
    nextLevel: options.nextConfidence,
    hasMissingEvidence,
    evidenceLooksConcrete,
  });
}

function calculateResumeCompleteness(input: {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
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
  const hasEducation =
    input.education
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0).length > 0
      ? 1
      : 0;

  return (hasSummary + hasSkills + hasHighlights + hasEducation) / 4;
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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [availableJobs, setAvailableJobs] = useState(jobs);
  const [analyzedJobsState, setAnalyzedJobsState] = useState<AnalyzedJobsState>({});
  const [computedAnalysesState, setComputedAnalysesState] = useState<ComputedJobAnalysesState>({});
  const [selectedJobId, setSelectedJobId] = useState(() => analyses[0]?.jobId ?? "");
  const selectedJobIdRef = useRef(selectedJobId);
  selectedJobIdRef.current = selectedJobId;
  const [jobStatuses, setJobStatuses] = useState<JobStatusMap>(() =>
    typeof window === "undefined" ? {} : getStoredJobStatuses(),
  );
  const [singleJobError, setSingleJobError] = useState<string | null>(null);
  const [singleJobContextNotice, setSingleJobContextNotice] = useState<string | null>(null);
  const [isGeneratingSingleJobAnalysis, setIsGeneratingSingleJobAnalysis] = useState(false);
  const [analysisProgressIndex, setAnalysisProgressIndex] = useState(0);
  const [analysisCanRetry, setAnalysisCanRetry] = useState(false);
  const [analysisFeedbackStatus, setAnalysisFeedbackStatus] =
    useState<AnalysisFeedbackStatus>("idle");
  const [analysisFeedbackMessage, setAnalysisFeedbackMessage] = useState<string | null>(null);
  const [analysisFailureCode, setAnalysisFailureCode] = useState<AnalysisFailureCode | null>(null);
  const [resumeSummaryInput, setResumeSummaryInput] = useState(() => {
    if (typeof window === "undefined") return currentResume.summary;
    const stored = getStoredResumeInput();
    return stored.summary || currentResume.summary;
  });
  const [resumeSkillsInput, setResumeSkillsInput] = useState(() => {
    if (typeof window === "undefined") return currentResume.skills.join(", ");
    const stored = getStoredResumeInput();
    return stored.skills || currentResume.skills.join(", ");
  });
  const [resumeHighlightsInput, setResumeHighlightsInput] = useState(() => {
    if (typeof window === "undefined") {
      return currentResume.experience.flatMap((item) => item.highlights).join("\n");
    }
    const stored = getStoredResumeInput();
    return (
      stored.highlights || currentResume.experience.flatMap((item) => item.highlights).join("\n")
    );
  });
  const [resumeEducationInput, setResumeEducationInput] = useState(() => {
    if (typeof window === "undefined") return "";
    return getStoredResumeInput().education;
  });
  const [copyResumeNotice, setCopyResumeNotice] = useState<string | null>(null);
  const [exportResumeNotice, setExportResumeNotice] = useState<string | null>(null);
  const [exportTailoredDraftDialogOpen, setExportTailoredDraftDialogOpen] = useState(false);
  const [tailoredDraftActionIntent, setTailoredDraftActionIntent] =
    useState<TailoredDraftResumeIntent>("export");
  const [tailoredDraftModalOpen, setTailoredDraftModalOpen] = useState(false);
  const [tailoredDraft, setTailoredDraft] = useState<TailoredResumeDraft | null>(null);
  const [isDraftingTailoredResume, setIsDraftingTailoredResume] = useState(false);
  const [isSavingTailoredDraft, setIsSavingTailoredDraft] = useState(false);
  const [tailoredDraftFailureOpen, setTailoredDraftFailureOpen] = useState(false);
  const [tailoredDraftFailureMessage, setTailoredDraftFailureMessage] = useState<string | null>(null);
  const [tailoredDraftFailureCode, setTailoredDraftFailureCode] =
    useState<TailoredDraftFailureCode | null>(null);
  const [tailoredDraftCanRetry, setTailoredDraftCanRetry] = useState(false);
  const [tailoredDraftSourceResumeId, setTailoredDraftSourceResumeId] = useState<string | null>(null);
  const [tailoredDraftSourceResumeName, setTailoredDraftSourceResumeName] = useState<string | null>(null);
  const [tailoredDraftUpdatedAt, setTailoredDraftUpdatedAt] = useState<string | null>(null);
  const [showPendingTailoredDraftBanner, setShowPendingTailoredDraftBanner] = useState(false);
  const [savedTailoredVersion, setSavedTailoredVersion] = useState<StoredResumeRecord | null>(null);
  const [isRerunningAfterTailoredSave, setIsRerunningAfterTailoredSave] = useState(false);
  const [resumeSavedNotice, setResumeSavedNotice] = useState<string | null>(null);
  const [clearSavedJobsDialogOpen, setClearSavedJobsDialogOpen] = useState(false);
  const [removeJobDialogOpen, setRemoveJobDialogOpen] = useState(false);
  const [showInlineOptimize, setShowInlineOptimize] = useState(false);
  const [showInlineResumeEditor, setShowInlineResumeEditor] = useState(false);
  const optimizeRef = useRef<HTMLElement | null>(null);
  const resumeEditorRef = useRef<HTMLElement | null>(null);
  const [structuredGapsByJob, setStructuredGapsByJob] = useState<Record<string, StructuredGap[]>>({});
  const [contextResumeId, setContextResumeId] = useState<string | null>(null);
  const autoAnalysisStartedForJobRef = useRef<string | null>(null);
  const singleJobAnalysisInFlightRef = useRef(false);
  const scrollToResultsAfterAnalysisRef = useRef(false);
  const tailoredRerunResumeNameRef = useRef<string | null>(null);
  const fitResultsRef = useRef<HTMLDivElement | null>(null);
  const hasResumeInput =
    resumeSummaryInput.trim().length > 0 ||
    resumeSkillsInput.trim().length > 0 ||
    resumeHighlightsInput.trim().length > 0 ||
    resumeEducationInput.trim().length > 0;
  const storedResumeInput = mounted
    ? getStoredResumeInput()
    : { summary: "", skills: "", highlights: "", education: "" };
  const resumeUploadState = mounted ? getStoredResumeUploadState() : null;
  const resumeSavedAt = mounted ? getResumeSavedAt() : null;
  const resumeParsedAt = mounted ? getResumeParsedAt() : null;
  const resumePersistence = mounted
    ? getResumePersistenceState()
    : {
        activeResumeId: null,
        activeResumeName: null,
        createdAt: null,
        updatedAt: null,
        sourceFileName: null,
      };
  const resumeWorkspaceSnapshot = {
    stored: storedResumeInput,
    draft: {
      summary: resumeSummaryInput,
      skills: resumeSkillsInput,
      highlights: resumeHighlightsInput,
      education: resumeEducationInput,
    },
    upload: resumeUploadState,
    savedAt: resumeSavedAt,
    parsedAt: resumeParsedAt,
    activeResumeId: resumePersistence.activeResumeId,
    activeResumeName: resumePersistence.activeResumeName,
    createdAt: resumePersistence.createdAt,
    updatedAt: resumePersistence.updatedAt,
    sourceFileName: resumePersistence.sourceFileName,
  };

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
  const fitBand = analysis ? getFitBand(analysis.score) : null;
  const resultsBullets = analysis ? partitionResultsBullets(analysis) : null;
  const topPriorityNextStep =
    analysis?.suggestedEdits[0]?.trim() ||
    resultsBullets?.resumeGaps[0] ||
    "Add one concrete resume example for this role, then re-run analysis.";
  const resumeCompleteness = calculateResumeCompleteness({
    summary: resumeSummaryInput,
    skills: resumeSkillsInput,
    highlights: resumeHighlightsInput,
    education: resumeEducationInput,
  });
  const confidenceLevel: ConfidenceLevel = getStoredOrInferredConfidence({
    storedConfidence: computedAnalysis?.confidenceLevel,
    resumeCompleteness,
    missingEvidenceCount: computedAnalysis?.missingEvidence.length ?? 0,
    keyRequirementEvidenceCount: analysis?.strengths.length ?? 0,
    evidenceItems: analysis?.strengths ?? [],
  });
  const encouragingEvidenceInsight =
    analysis && fitBand
      ? getEncouragingEvidenceInsight({
          fitBand,
          fit: analysis.fit,
          evidenceLevel: confidenceLevel,
        })
      : null;
  const resultsResumeContext = useMemo((): ResultsResumeContext => {
    const display = resolveResultsDisplayResume(computedAnalysis);
    const record =
      (contextResumeId ? getResumeRecord(contextResumeId) : null) ?? display.record;
    const resumeId = record?.id ?? display.resumeId;
    const resumeName = record?.name?.trim() || display.resumeName;
    const activeResumeId = display.activeResumeId;
    return {
      ...display,
      resumeId,
      resumeName,
      record,
      input: {
        summary: resumeSummaryInput,
        skills: resumeSkillsInput,
        highlights: resumeHighlightsInput,
        education: resumeEducationInput,
      },
      differsFromActive: Boolean(
        resumeId && activeResumeId && resumeId !== activeResumeId,
      ),
    };
  }, [
    computedAnalysis,
    contextResumeId,
    resumeEducationInput,
    resumeHighlightsInput,
    resumeSkillsInput,
    resumeSummaryInput,
  ]);

  useEffect(() => {
    if (!mounted || !job?.id || tailoredDraftModalOpen || tailoredDraft) {
      if (!tailoredDraft && job?.id) {
        setShowPendingTailoredDraftBanner(hasPendingTailoredDraftForJob(job.id));
      } else {
        setShowPendingTailoredDraftBanner(false);
      }
      return;
    }
    setShowPendingTailoredDraftBanner(hasPendingTailoredDraftForJob(job.id));
  }, [job?.id, mounted, tailoredDraft, tailoredDraftModalOpen]);

  const analyzedResumeVersionLabel =
    getResultsResumeLabel(resultsResumeContext) ??
    getAnalysisResumeVersionLabel(computedAnalysis) ??
    "Unknown resume";

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
  const userSavedJobCount = mounted ? getStoredUserJobs().length : 0;
  const showClearSavedJobs = userSavedJobCount > 1;

  function notifySessionDataChanged(): void {
    window.dispatchEvent(new Event("career-coach:analysis-updated"));
  }

  function refreshJobsFromStorage(): JobPosting[] {
    const nextJobs = getAllStoredJobs(jobs);
    setAvailableJobs(nextJobs);
    setAnalyzedJobsState(getAnalyzedJobsState());
    setComputedAnalysesState(getComputedJobAnalysesState());
    return nextJobs;
  }

  function selectJobAfterRemoval(removedJobId: string): void {
    const remaining = refreshJobsFromStorage().filter((jobItem) => jobItem.id !== removedJobId);
    const nextId = remaining[0]?.id ?? "";
    if (nextId) {
      setSelectedJob(nextId);
    } else {
      setSelectedJobId("");
      clearSelectedJobId();
    }
  }

  function handleRemoveCurrentJob(): void {
    if (!job || isGeneratingSingleJobAnalysis) return;
    setRemoveJobDialogOpen(true);
  }

  function handleConfirmRemoveCurrentJob(options: { removeLinkedTailoredResumes: boolean }) {
    if (!job || isGeneratingSingleJobAnalysis) return;
    const removedId = job.id;
    deleteUserJob(removedId, options);
    selectJobAfterRemoval(removedId);
    setRemoveJobDialogOpen(false);
    setSingleJobContextNotice(
      options.removeLinkedTailoredResumes
        ? "Job removed. Linked tailored resumes were removed."
        : "Job removed from your workspace.",
    );
  }

  function handleClearSavedJobs() {
    if (userSavedJobCount === 0 || isGeneratingSingleJobAnalysis) return;
    setClearSavedJobsDialogOpen(true);
  }

  function handleConfirmClearSavedJobs(options: { removeLinkedTailoredResumes: boolean }) {
    if (userSavedJobCount === 0 || isGeneratingSingleJobAnalysis) return;
    clearAllUserJobs(options);
    notifySessionDataChanged();
    const remaining = refreshJobsFromStorage();
    const nextId = remaining[0]?.id ?? "";
    if (nextId) {
      setSelectedJob(nextId);
    } else {
      setSelectedJobId("");
      clearSelectedJobId();
    }
    setClearSavedJobsDialogOpen(false);
    setSingleJobContextNotice(
      options.removeLinkedTailoredResumes
        ? "Saved jobs cleared. Linked tailored resumes were removed."
        : "Saved jobs cleared. Your resume versions are still saved.",
    );
  }

  function setSelectedJob(
    id: string,
    options?: { updatePendingContext?: boolean },
  ) {
    setSelectedJobId(id);
    persistSelectedJobId(id);
    if (options?.updatePendingContext === false) {
      return;
    }
    const analysisForJob = getComputedJobAnalysesState()[id];
    const displayContext = resolveResultsDisplayResume(analysisForJob);
    markPendingAnalysisContext(id, displayContext.resumeId);
    if (displayContext.resumeId) {
      setContextResumeId(displayContext.resumeId);
    }
  }

  function pendingResumeIdForAttempt(
    analysisResumeRecord: StoredResumeRecord | null,
  ): string | null {
    return analysisResumeRecord?.id ?? contextResumeId ?? getPendingAnalysisResumeId();
  }

  function logRetryContext(
    phase: string,
    options?: {
      retryJobId?: string | null;
      retryResumeId?: string | null;
      failureCode?: string | null;
      failureMessage?: string | null;
    },
  ): void {
    const pending = getPendingAnalysisContext();
    logAnalysisRetryDiagnostic({
      phase,
      pendingJobId: pending.jobId,
      pendingResumeId: pending.resumeId,
      retryJobId: options?.retryJobId ?? null,
      retryResumeId: options?.retryResumeId ?? null,
      failureCode: options?.failureCode ?? null,
      failureMessage: options?.failureMessage ?? null,
    });
  }

  function applyResumeInputToState(input: StoredResumeInput): void {
    setResumeSummaryInput(input.summary);
    setResumeSkillsInput(input.skills);
    setResumeHighlightsInput(input.highlights);
    setResumeEducationInput(input.education);
  }

  function syncResultsResumeContextFromAnalysis(
    analysisForJob: ComputedJobAnalysis | undefined,
  ): void {
    const ctx = resolveResultsDisplayResume(analysisForJob);
    setContextResumeId(ctx.resumeId);
    applyResumeInputToState(ctx.input);
  }

  function persistInlineResumeDraft(
    next: StoredResumeInput,
    targetResumeId: string | null = contextResumeId,
  ): void {
    const normalized = {
      summary: next.summary.trim(),
      skills: next.skills.trim(),
      highlights: next.highlights.trim(),
      education: next.education.trim(),
    };
    if (targetResumeId) {
      saveResumeDraftForRecord(targetResumeId, normalized);
      return;
    }
    saveStoredResumeDraft(normalized);
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
    syncResultsResumeContextFromAnalysis(nextComputedAnalysesState[initialSelectedJobId]);
    setMounted(true);
    const refreshAll = () => {
      refreshJobs();
      const latestAnalyses = getComputedJobAnalysesState();
      setComputedAnalysesState(latestAnalyses);
      syncResultsResumeContextFromAnalysis(latestAnalyses[selectedJobIdRef.current]);
      setJobStatuses(getStoredJobStatuses());
    };
    window.addEventListener("storage", refreshAll);
    window.addEventListener("focus", refreshAll);
    window.addEventListener("career-coach:analysis-updated", refreshAll);
    window.addEventListener(RESUME_STORAGE_CHANGED_EVENT, refreshAll);
    window.addEventListener(JOB_PIPELINE_UPDATED_EVENT, refreshAll);
    return () => {
      window.removeEventListener("storage", refreshAll);
      window.removeEventListener("focus", refreshAll);
      window.removeEventListener("career-coach:analysis-updated", refreshAll);
      window.removeEventListener(RESUME_STORAGE_CHANGED_EVENT, refreshAll);
      window.removeEventListener(JOB_PIPELINE_UPDATED_EVENT, refreshAll);
    };
  }, []);

  useEffect(() => {
    setSingleJobError(null);
    setSingleJobContextNotice(null);
    setResumeSavedNotice(null);
    setAnalysisCanRetry(false);
    setAnalysisFeedbackStatus("idle");
    setAnalysisFeedbackMessage(null);
    setAnalysisFailureCode(null);
    setShowInlineOptimize(false);
    setShowInlineResumeEditor(false);
    syncResultsResumeContextFromAnalysis(computedAnalysesState[selectedJobId]);
  }, [selectedJobId]);

  const persistInlineResumeFields = useCallback((): boolean => {
    const fields = {
      summary: resumeSummaryInput.trim(),
      skills: resumeSkillsInput.trim(),
      highlights: resumeHighlightsInput.trim(),
      education: resumeEducationInput.trim(),
    };
    if (!fields.summary && !fields.skills && !fields.highlights && !fields.education) {
      return false;
    }
    if (contextResumeId) {
      saveResumeInputForRecord(contextResumeId, fields);
      return true;
    }
    saveStoredResumeInput(fields);
    return true;
  }, [
    contextResumeId,
    resumeEducationInput,
    resumeHighlightsInput,
    resumeSkillsInput,
    resumeSummaryInput,
  ]);

  useEffect(() => {
    if (!isGeneratingSingleJobAnalysis) {
      setAnalysisProgressIndex(0);
      return;
    }

    setAnalysisProgressIndex(0);
    const interval = window.setInterval(() => {
      setAnalysisProgressIndex((current) =>
        Math.min(current + 1, ANALYSIS_PROGRESS_STEPS.length - 1),
      );
    }, 2200);

    return () => window.clearInterval(interval);
  }, [isGeneratingSingleJobAnalysis]);

  useEffect(() => {
    if (!scrollToResultsAfterAnalysisRef.current || !hasReadyFitAnalysis || !job) return;

    scrollToResultsAfterAnalysisRef.current = false;
    const timer = window.setTimeout(() => {
      fitResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [hasReadyFitAnalysis, job, selectedJobId]);

  const applyOptimizeDocToResumeContext = useCallback(
    (doc: OptimizeDocument) => {
      const nextInput: StoredResumeInput = {
        summary: sanitizeResumeLineForOutput(doc.summary ?? ""),
        skills: (doc.tools ?? [])
          .map((tool) => sanitizeResumeLineForOutput(tool))
          .filter((tool) => tool.length > 0)
          .join(", "),
        highlights: (doc.experience ?? [])
          .flatMap((entry) => entry.bullets ?? [])
          .map((bullet) => sanitizeResumeLineForOutput(bullet))
          .filter((bullet) => bullet.length > 0)
          .join("\n"),
        education: (doc.education ?? [])
          .map((entry) => {
            const parts = [entry.degree, entry.school, entry.dates].filter(Boolean).join(" · ");
            return sanitizeResumeLineForOutput(parts);
          })
          .filter((line) => line.length > 0)
          .join("\n"),
      };
      setResumeSummaryInput(nextInput.summary);
      setResumeSkillsInput(nextInput.skills);
      setResumeHighlightsInput(nextInput.highlights);
      setResumeEducationInput(nextInput.education);
      if (contextResumeId) {
        saveResumeDraftForRecord(contextResumeId, nextInput);
      } else {
        saveStoredResumeDraft(nextInput);
      }
      setCopyResumeNotice(null);
    },
    [contextResumeId],
  );

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

  const generateSingleJobAnalysis = useCallback(
    async (
      eventName: "run_analysis" | "rerun_analysis",
      options?: {
        forceRefresh?: boolean;
        resumeIdForRun?: string;
        resumeInputForRun?: StoredResumeInput;
      },
    ) => {
    if (!job) {
      setSingleJobContextNotice("Select a job to generate single-job analysis.");
      setSingleJobError(null);
      setAnalysisCanRetry(false);
      setAnalysisFailureCode("missing_job");
      setAnalysisFeedbackStatus("failed");
      setAnalysisFeedbackMessage(messageForAnalysisFailureCode("missing_job").message);
      return;
    }
    if (isGeneratingSingleJobAnalysis || singleJobAnalysisInFlightRef.current) return;

    const inlineResumeInput: StoredResumeInput = {
      summary: resumeSummaryInput,
      skills: resumeSkillsInput,
      highlights: resumeHighlightsInput,
      education: resumeEducationInput,
    };
    const analysisResumeResolution = options?.resumeIdForRun
      ? (() => {
          const overrideRecord = getResumeRecord(options.resumeIdForRun);
          const overrideInput =
            options.resumeInputForRun ??
            (overrideRecord ? recordToInput(overrideRecord) : inlineResumeInput);
          return resolveResumeForAnalysisRun({
            computedAnalysis: computedAnalysesState[job.id],
            contextResumeId: options.resumeIdForRun,
            inlineInput: overrideInput,
          });
        })()
      : resolveResumeForAnalysisRun({
          computedAnalysis: computedAnalysesState[job.id],
          contextResumeId,
          inlineInput: inlineResumeInput,
        });
    const analysisResumeInput = analysisResumeResolution.input;
    const analysisResumeRecord = analysisResumeResolution.record;

    const resumeContext = buildAnalysisResumeContext(analysisResumeInput);

    const requestValidation = validateAnalysisRequest({
      jobDescription: job.description,
      resumeContext,
      jobTitle: job.title,
      jobCompany: job.company,
    });

    if (!requestValidation.ok) {
      const retryResumeId = pendingResumeIdForAttempt(analysisResumeRecord);
      markPendingAnalysisContext(job.id, retryResumeId);
      logRetryContext("validation_failed", {
        retryJobId: job.id,
        retryResumeId,
        failureCode: requestValidation.code,
        failureMessage: requestValidation.message,
      });
      setAnalysisCanRetry(false);
      setAnalysisFailureCode(requestValidation.code);
      setAnalysisFeedbackStatus("failed");
      setAnalysisFeedbackMessage(requestValidation.message);
      setSingleJobError(null);
      return;
    }

    const retryResumeId = pendingResumeIdForAttempt(analysisResumeRecord);
    markPendingAnalysisContext(job.id, retryResumeId);
    logRetryContext("analysis_started", {
      retryJobId: job.id,
      retryResumeId,
    });

    const inputFingerprint = buildAnalysisInputFingerprint({
      jobId: job.id,
      jobDescription: job.description,
      resumeContext,
    });
    const storedComputed = computedAnalysesState[job.id];
    const shouldUseCachedAnalysis =
      storedComputed?.analysisState === "ready" &&
      storedComputed.inputFingerprint === inputFingerprint &&
      (!storedComputed.resumeVersionId ||
        storedComputed.resumeVersionId === analysisResumeRecord?.id);

    if (shouldUseCachedAnalysis) {
      setJobAnalyzed(job.id, true);
      setAnalyzedJobsState((prev) => ({ ...prev, [job.id]: true }));
      const currentStatus = getStoredJobStatuses()[job.id];
      if (!currentStatus || currentStatus === "Analyzed") {
        setStoredJobStatus(job.id, "Analyzed");
      }
      setComputedAnalysesState((prev) => ({ ...prev, [job.id]: storedComputed }));
      setSelectedJob(job.id, { updatePendingContext: false });
      clearPendingAnalysisContext();
      syncResultsResumeContextFromAnalysis(storedComputed);
      logRetryContext("cache_hit_success", {
        retryJobId: job.id,
        retryResumeId: analysisResumeRecord?.id ?? retryResumeId,
      });
      setSingleJobError(null);
      setSingleJobContextNotice("Showing your saved analysis for these inputs.");
      setAnalysisFeedbackStatus("success");
      setAnalysisFeedbackMessage(ANALYSIS_SUCCESS_MESSAGE);
      window.dispatchEvent(new Event("career-coach:analysis-updated"));
      return;
    }

    const contentFingerprint = buildResumeJobContentFingerprint({
      jobDescription: job.description,
      resumeContext,
    });
    const cachedOutputPayload = getAnalysisOutputCache(contentFingerprint);
    if (cachedOutputPayload) {
      setJobAnalyzed(job.id, true);
      setAnalyzedJobsState((prev) => ({ ...prev, [job.id]: true }));
      const cachedStatus = getStoredJobStatuses()[job.id];
      if (!cachedStatus || cachedStatus === "Analyzed") {
        setStoredJobStatus(job.id, "Analyzed");
      }
      const cachedBase = toComputedJobAnalysis(job.id, cachedOutputPayload);
      const cachedResumeCompleteness = calculateResumeCompleteness(analysisResumeInput);
      const cachedConfidence = inferConfidenceLevel({
        resumeCompleteness: cachedResumeCompleteness,
        missingEvidenceCount: cachedBase.missingEvidence.length,
        keyRequirementEvidenceCount: cachedBase.strengths.length,
        evidenceItems: cachedBase.strengths,
      });
      const cachedResumeSnapshot = buildAnalysisResumeSnapshotFromInput(analysisResumeInput);
      const cachedComputed = enrichComputedJobAnalysisWithResumeLink(
        {
          ...cachedBase,
          inputFingerprint,
          confidenceLevel: cachedConfidence,
        },
        {
          job,
          resumeVersion: analysisResumeRecord
            ? { id: analysisResumeRecord.id, name: analysisResumeRecord.name }
            : null,
          resumeSnapshot: cachedResumeSnapshot,
          candidateName: getStoredProfile().fullName || profile.fullName,
        },
      );
      setComputedJobAnalysis(cachedComputed);
      setComputedAnalysesState((prev) => ({ ...prev, [job.id]: cachedComputed }));
      setSelectedJob(job.id, { updatePendingContext: false });
      clearPendingAnalysisContext();
      syncResultsResumeContextFromAnalysis(cachedComputed);
      logRetryContext("content_cache_hit_success", {
        retryJobId: job.id,
        retryResumeId: analysisResumeRecord?.id ?? retryResumeId,
      });
      setSingleJobError(null);
      setSingleJobContextNotice("Showing your saved analysis for these inputs.");
      setAnalysisFeedbackStatus("success");
      setAnalysisFeedbackMessage(ANALYSIS_SUCCESS_MESSAGE);
      window.dispatchEvent(new Event("career-coach:analysis-updated"));
      return;
    }

    logEvent(eventName, { jobTitle: job.title });

    singleJobAnalysisInFlightRef.current = true;
    setIsGeneratingSingleJobAnalysis(true);
    setAnalysisCanRetry(false);
    setAnalysisFailureCode(null);
    setSingleJobError(null);
    setSingleJobContextNotice(null);
    setAnalysisFeedbackStatus("running");
    setAnalysisFeedbackMessage("Analysis running…");
    const previousConfidence: ConfidenceLevel | null = hasReadyFitAnalysis
      ? getStoredOrInferredConfidence({
          storedConfidence: storedComputed?.confidenceLevel,
          resumeCompleteness,
          missingEvidenceCount: storedComputed?.missingEvidence.length ?? 0,
          keyRequirementEvidenceCount: analysis?.strengths.length ?? 0,
          evidenceItems: analysis?.strengths ?? [],
        })
      : null;
    const activeResume = analysisResumeRecord;
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
          resumeMeta: {
            id: activeResume?.id ?? null,
            name: activeResume?.name ?? null,
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
        let failureBody: { error?: string; retryable?: boolean; code?: string } | null = null;
        try {
          failureBody = (await response.json()) as {
            error?: string;
            retryable?: boolean;
            code?: string;
          };
        } catch {
          failureBody = null;
        }
        const failure = parseAnalysisFailureResponse(response.status, failureBody
          ? {
              ...failureBody,
              code: failureBody.code as AnalysisFailureCode | undefined,
            }
          : null);
        setAnalysisCanRetry(failure.retryable);
        setAnalysisFailureCode(failure.code ?? null);
        setAnalysisFeedbackStatus("failed");
        setAnalysisFeedbackMessage(failure.message);
        setSingleJobError(null);
        markPendingAnalysisContext(job.id, retryResumeId);
        logRetryContext("api_failed", {
          retryJobId: job.id,
          retryResumeId,
          failureCode: failure.code ?? failureBody?.code ?? null,
          failureMessage: failure.message,
        });
        return;
      }
      const payload = (await response.json()) as AnalyzeSelectedJobOutput;
      setAnalysisOutputCache(contentFingerprint, payload);
      const unavailableMessage = getProviderUnavailableMessage(payload);
      if (unavailableMessage) {
        const apiKeyFailure = messageForAnalysisFailureCode("api_key_missing");
        setAnalysisCanRetry(apiKeyFailure.retryable);
        setAnalysisFailureCode("api_key_missing");
        setAnalysisFeedbackStatus("failed");
        setAnalysisFeedbackMessage(apiKeyFailure.message);
        setSingleJobError(null);
        markPendingAnalysisContext(job.id, retryResumeId);
        logRetryContext("api_key_missing", {
          retryJobId: job.id,
          retryResumeId,
          failureCode: "api_key_missing",
          failureMessage: apiKeyFailure.message,
        });
        return;
      }
      setJobAnalyzed(job.id, true);
      setAnalyzedJobsState((prev) => ({ ...prev, [job.id]: true }));
      const currentStatus = getStoredJobStatuses()[job.id];
      if (!currentStatus || currentStatus === "Analyzed") {
        setStoredJobStatus(job.id, "Analyzed");
      }
      const computedBase = toComputedJobAnalysis(job.id, payload);
      const analysisResumeCompleteness = calculateResumeCompleteness(analysisResumeInput);
      const nextConfidence = inferConfidenceLevel({
        resumeCompleteness: analysisResumeCompleteness,
        missingEvidenceCount: computedBase.missingEvidence.length,
        keyRequirementEvidenceCount: computedBase.strengths.length,
        evidenceItems: computedBase.strengths,
      });
      const resumeSnapshot = buildAnalysisResumeSnapshotFromInput(analysisResumeInput);
      const computed = enrichComputedJobAnalysisWithResumeLink(
        {
          ...computedBase,
          inputFingerprint,
          confidenceLevel: nextConfidence,
        },
        {
          job,
          resumeVersion: activeResume
            ? { id: activeResume.id, name: activeResume.name }
            : null,
          resumeSnapshot,
          candidateName: getStoredProfile().fullName || profile.fullName,
        },
      );
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
      clearPendingAnalysisContext();
      if (activeResume) {
        setContextResumeId(activeResume.id);
        applyResumeInputToState(analysisResumeInput);
      }
      setSelectedJob(job.id, { updatePendingContext: false });
      logRetryContext("analysis_succeeded", {
        retryJobId: job.id,
        retryResumeId: activeResume?.id ?? retryResumeId,
      });
      window.dispatchEvent(new Event("career-coach:analysis-updated"));
      scrollToResultsAfterAnalysisRef.current = true;
      setAnalysisFeedbackStatus("success");
      if (tailoredRerunResumeNameRef.current) {
        setAnalysisFeedbackMessage(
          `Re-analysis complete using ${tailoredRerunResumeNameRef.current}.`,
        );
        tailoredRerunResumeNameRef.current = null;
      } else {
        setAnalysisFeedbackMessage(ANALYSIS_SUCCESS_MESSAGE);
      }
      if (confidenceChangeMessage) {
        setSingleJobContextNotice(confidenceChangeMessage);
      }
    } catch (error) {
      console.error("single-job-analysis-error", error);
      const failure = toUserFacingAnalysisError(error);
      setAnalysisCanRetry(failure.retryable);
      setAnalysisFailureCode(failure.code);
      setAnalysisFeedbackStatus("failed");
      setAnalysisFeedbackMessage(failure.message);
      setSingleJobError(null);
      markPendingAnalysisContext(job.id, retryResumeId);
      logRetryContext("analysis_exception", {
        retryJobId: job.id,
        retryResumeId,
        failureCode: failure.code,
        failureMessage: failure.message,
      });
    } finally {
      singleJobAnalysisInFlightRef.current = false;
      setIsGeneratingSingleJobAnalysis(false);
    }
  },
  [
    analysis,
    computedAnalysesState,
    contextResumeId,
    hasReadyFitAnalysis,
    isGeneratingSingleJobAnalysis,
    job,
    optimizeData,
    resumeCompleteness,
    resumeEducationInput,
    resumeHighlightsInput,
    resumeSkillsInput,
    resumeSummaryInput,
  ]);

  const handleAnalyzeAction = useCallback(
    (forceRerun = false) => {
      if (!job) return;

      const resumeContext = buildAnalysisResumeContext({
        summary: resumeSummaryInput,
        skills: resumeSkillsInput,
        highlights: resumeHighlightsInput,
        education: resumeEducationInput,
      });
      const validation = validateAnalysisRequest({
        jobDescription: job.description,
        resumeContext,
        jobTitle: job.title,
        jobCompany: job.company,
      });

      if (!validation.ok) {
        setAnalysisCanRetry(false);
        setAnalysisFailureCode(validation.code);
        setAnalysisFeedbackStatus("failed");
        setAnalysisFeedbackMessage(validation.message);
        setSingleJobError(null);
        return;
      }

      if (!persistInlineResumeFields()) {
        setAnalysisCanRetry(false);
        setAnalysisFailureCode("missing_resume");
        setAnalysisFeedbackStatus("failed");
        setAnalysisFeedbackMessage(messageForAnalysisFailureCode("missing_resume").message);
        setSingleJobError(null);
        return;
      }
      if (forceRerun || hasReadyFitAnalysis) {
        setResumeSavedNotice("Resume updates saved for this analysis.");
      }
      void generateSingleJobAnalysis(forceRerun || hasReadyFitAnalysis ? "rerun_analysis" : "run_analysis", {
        forceRefresh: forceRerun || hasReadyFitAnalysis,
      });
    },
    [
      generateSingleJobAnalysis,
      hasReadyFitAnalysis,
      job,
      persistInlineResumeFields,
      resumeEducationInput,
      resumeHighlightsInput,
      resumeSkillsInput,
      resumeSummaryInput,
    ],
  );

  const handleSaveResumeOnly = useCallback(() => {
    if (!persistInlineResumeFields()) {
      setSingleJobError("Add resume content before saving.");
      return;
    }
    setResumeSavedNotice("Resume updates saved for this analysis.");
    setSingleJobError(null);
  }, [persistInlineResumeFields]);

  const handleRetryAnalysis = useCallback(() => {
    if (isGeneratingSingleJobAnalysis || singleJobAnalysisInFlightRef.current) return;

    const pending = getPendingAnalysisContext();
    const retryJobId = pending.jobId ?? job?.id ?? null;
    const retryResumeId = pending.resumeId ?? contextResumeId;

    if (retryResumeId) {
      setContextResumeId(retryResumeId);
      const record = getResumeRecord(retryResumeId);
      if (record) {
        applyResumeInputToState({
          summary: record.summary,
          skills: record.skills,
          highlights: record.experience,
          education: record.education,
        });
      }
    }

    if (retryJobId && retryJobId !== selectedJobId) {
      setSelectedJobId(retryJobId);
      persistSelectedJobId(retryJobId);
    }

    logRetryContext("retry_requested", {
      retryJobId,
      retryResumeId,
      failureCode: analysisFailureCode,
      failureMessage: analysisFeedbackMessage,
    });

    void generateSingleJobAnalysis("rerun_analysis", { forceRefresh: true });
  }, [
    analysisFailureCode,
    analysisFeedbackMessage,
    contextResumeId,
    generateSingleJobAnalysis,
    isGeneratingSingleJobAnalysis,
    job?.id,
    selectedJobId,
  ]);

  const handleRunAnalysisLater = useCallback(() => {
    logRetryContext("run_later_dismissed", {
      retryJobId: job?.id ?? getPendingAnalysisJobId(),
      retryResumeId: contextResumeId ?? getPendingAnalysisResumeId(),
      failureCode: analysisFailureCode,
      failureMessage: analysisFeedbackMessage,
    });
    setSingleJobError(null);
    setAnalysisCanRetry(false);
    setAnalysisFeedbackStatus("idle");
    setAnalysisFeedbackMessage(null);
    setAnalysisFailureCode(null);
  }, [
    analysisFailureCode,
    analysisFeedbackMessage,
    contextResumeId,
    job?.id,
  ]);

  useEffect(() => {
    if (!mounted || !job || isGeneratingSingleJobAnalysis || hasReadyFitAnalysis) return;

    const pendingJobId = getPendingAnalysisJobId();
    if (!pendingJobId || pendingJobId !== selectedJobId) return;

    const pendingAnalysisInput = getStoredResumeInputForAnalysis();
    const resumeContext = buildAnalysisResumeContext(pendingAnalysisInput);
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
    resumeEducationInput,
    resumeHighlightsInput,
    resumeSkillsInput,
    resumeSummaryInput,
    selectedJobId,
  ]);

  function getEffectiveTailoredDraft(): TailoredResumeDraft | null {
    if (tailoredDraft) return tailoredDraft;
    if (!job) return null;
    const pending = getPendingTailoredDraftForJob(job.id);
    return pending ? pendingToTailoredDraft(pending) : null;
  }

  function getCurrentDraftSource(): { id: string; name: string } | null {
    const sourceRecord =
      (tailoredDraftSourceResumeId ? getResumeRecord(tailoredDraftSourceResumeId) : null) ??
      resultsResumeContext.record;
    if (!sourceRecord) return null;
    return { id: sourceRecord.id, name: sourceRecord.name };
  }

  function persistTailoredDraftToStorage(draft: TailoredResumeDraft): boolean {
    if (!job) return false;
    const sourceRecord = getCurrentDraftSource();
    const existing = getPendingTailoredDraftForJob(job.id);
    const saved = savePendingTailoredDraft(
      buildPendingTailoredDraft({
        job,
        sourceResume:
          sourceRecord ??
          (existing
            ? { id: existing.sourceResumeId, name: existing.sourceResumeName }
            : null),
        draft,
        existingDraftId: existing?.draftId,
        existingCreatedAt: existing?.createdAt,
      }),
    );
    if (saved) {
      const refreshed = getPendingTailoredDraftForJob(job.id);
      setTailoredDraftUpdatedAt(refreshed?.updatedAt ?? new Date().toISOString());
    }
    return saved;
  }

  function getTailoredDraftSourceInput(): StoredResumeInput | null {
    const sourceRecord =
      (tailoredDraftSourceResumeId ? getResumeRecord(tailoredDraftSourceResumeId) : null) ??
      resultsResumeContext.record ??
      (computedAnalysis?.resumeVersionId
        ? getResumeRecord(computedAnalysis.resumeVersionId)
        : null) ??
      getActiveResumeRecord();
    return sourceRecord ? recordToInput(sourceRecord) : null;
  }

  function resolveResultsPageExport(includeUnsavedTailoredDraft: boolean) {
    const storedProfile = getStoredProfile();
    const draft = includeUnsavedTailoredDraft ? getEffectiveTailoredDraft() : null;
    return resolveResultsExport({
      job: job ?? null,
      computedAnalysis,
      resultsResumeContext,
      savedTailoredVersion,
      tailoredDraft: draft,
      tailoredDraftSourceInput: draft ? getTailoredDraftSourceInput() : null,
      profileFullName: storedProfile.fullName || profile.fullName,
      profileContact: {
        location: storedProfile.location,
        workPermit: storedProfile.workPermit,
        languages: storedProfile.languages,
      },
    });
  }

  async function applyReadyResolution(
    resolution: Extract<ResultsExportResolution, { kind: "ready" }>,
    intent: TailoredDraftResumeIntent,
  ) {
    if (intent === "export") {
      await performResultsExport(
        resolution.versionName,
        resolution.content,
        resolution.usesAnalysisSnapshot,
      );
      return;
    }
    await performResultsCopy(
      resolution.versionName,
      buildResumeExportPlainText(resolution.content),
      resolution.usesAnalysisSnapshot,
    );
  }

  async function performResultsExport(
    versionName: string,
    content: Parameters<typeof downloadResumeExport>[0],
    usesAnalysisSnapshot: boolean,
  ) {
    const exportNotice = buildResumeExportNotice(versionName, content);
    const notice = usesAnalysisSnapshot
      ? `${ANALYSIS_SNAPSHOT_EXPORT_NOTICE} ${exportNotice}`
      : exportNotice;
    setExportResumeNotice(notice);
    setCopyResumeNotice(null);
    logEvent("download_resume", { format: "docx", usesAnalysisSnapshot });
    try {
      await downloadResumeExport(content);
    } catch {
      setExportResumeNotice("Could not export resume as DOCX. Please try again.");
    }
  }

  async function performResultsCopy(
    versionName: string,
    text: string,
    usesAnalysisSnapshot: boolean,
  ) {
    const notice = usesAnalysisSnapshot
      ? `${ANALYSIS_SNAPSHOT_COPY_NOTICE} Copied ${versionName}.`
      : `Copied ${versionName}.`;
    setCopyResumeNotice(notice);
    setExportResumeNotice(null);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setCopyResumeNotice("Could not copy resume. Please try again.");
    }
  }

  function openTailoredDraftActionDialog(intent: TailoredDraftResumeIntent) {
    setTailoredDraftActionIntent(intent);
    setExportTailoredDraftDialogOpen(true);
  }

  async function exportResume() {
    const resolution = resolveResultsPageExport(true);
    if (resolution.kind === "unsaved-tailored-draft") {
      openTailoredDraftActionDialog("export");
      return;
    }
    if (resolution.kind !== "ready") return;
    await applyReadyResolution(resolution, "export");
  }

  async function copyResumeText() {
    const resolution = resolveResultsPageExport(true);
    if (resolution.kind === "unsaved-tailored-draft") {
      openTailoredDraftActionDialog("copy");
      return;
    }
    if (resolution.kind !== "ready") return;
    await applyReadyResolution(resolution, "copy");
  }

  async function handleApplySavedVersionFromPrompt() {
    setExportTailoredDraftDialogOpen(false);
    const resolution = resolveResultsPageExport(false);
    if (resolution.kind !== "ready") return;
    await applyReadyResolution(resolution, tailoredDraftActionIntent);
  }

  function saveTailoredDraftAsVersion(draft: TailoredResumeDraft): StoredResumeRecord | null {
    if (!job) return null;

    const sourceRecord =
      (tailoredDraftSourceResumeId ? getResumeRecord(tailoredDraftSourceResumeId) : null) ??
      resultsResumeContext.record ??
      (computedAnalysis?.resumeVersionId
        ? getResumeRecord(computedAnalysis.resumeVersionId)
        : null) ??
      getActiveResumeRecord();
    const versionName = buildTailoredResumeVersionName(job.title, job.company);
    const sourceInput = sourceRecord ? recordToInput(sourceRecord) : null;
    const mergedInput = sourceInput
      ? mergeTailoredFieldsWithSource(sourceInput, draftFieldsToStoredInput(draft))
      : draftFieldsToStoredInput(draft);

    return createTailoredResumeVersion(mergedInput, {
      name: versionName,
      sourceResumeId: sourceRecord?.id ?? "",
      sourceResumeName: sourceRecord?.name,
      tailoredForJobId: job.id,
      tailoredForJobTitle: job.title,
      tailoredForCompany: job.company,
      sourceFileName: sourceRecord?.sourceFileName,
      uploadFileType: sourceRecord?.uploadFileType,
    });
  }

  async function completeTailoredDraftSave(
    draft: TailoredResumeDraft,
    options: { rerun: boolean },
  ) {
    if (!job) return;
    setIsSavingTailoredDraft(true);

    if (!persistTailoredDraftToStorage(draft)) {
      setIsSavingTailoredDraft(false);
      return;
    }

    const savedRecord = saveTailoredDraftAsVersion(draft);
    if (!savedRecord) {
      setIsSavingTailoredDraft(false);
      return;
    }

    const savedInput = recordToInput(savedRecord);
    clearPendingTailoredDraftForJob(job.id);
    setShowPendingTailoredDraftBanner(false);
    setTailoredDraftUpdatedAt(null);
    setSavedTailoredVersion(savedRecord);
    setTailoredDraftModalOpen(false);
    setTailoredDraft(null);
    setTailoredDraftSourceResumeId(null);
    setTailoredDraftSourceResumeName(null);
    setIsSavingTailoredDraft(false);

    logEvent("save_tailored_resume_version", {
      jobId: job.id,
      versionName: savedRecord.name,
      resumeId: savedRecord.id,
      rerunAnalysis: options.rerun,
    });

    setContextResumeId(savedRecord.id);
    applyResumeInputToState(savedInput);
    markPendingAnalysisContext(job.id, savedRecord.id);

    if (options.rerun) {
      tailoredRerunResumeNameRef.current = savedRecord.name;
      setIsRerunningAfterTailoredSave(true);
      try {
        await generateSingleJobAnalysis("rerun_analysis", {
          forceRefresh: true,
          resumeIdForRun: savedRecord.id,
          resumeInputForRun: savedInput,
        });
      } finally {
        setIsRerunningAfterTailoredSave(false);
      }
      return;
    }

    setResumeSavedNotice(`Tailored resume saved as ${savedRecord.name}.`);
  }

  async function handleSaveAndRerunTailoredDraft(draft: TailoredResumeDraft) {
    await completeTailoredDraftSave(draft, { rerun: true });
  }

  async function handleSaveTailoredDraftWithoutRerun(draft: TailoredResumeDraft) {
    await completeTailoredDraftSave(draft, { rerun: false });
  }

  async function handleSaveAndApplyTailoredDraft() {
    if (!tailoredDraft || !job) return;
    setIsSavingTailoredDraft(true);

    const savedRecord = saveTailoredDraftAsVersion(tailoredDraft);
    if (!savedRecord) {
      setIsSavingTailoredDraft(false);
      return;
    }

    setTailoredDraftModalOpen(false);
    setTailoredDraft(null);
    setTailoredDraftSourceResumeId(null);
    setExportTailoredDraftDialogOpen(false);
    setIsSavingTailoredDraft(false);
    clearPendingTailoredDraftForJob(job.id);
    setShowPendingTailoredDraftBanner(false);

    logEvent("save_tailored_resume_version", {
      jobId: job.id,
      versionName: savedRecord.name,
      resumeId: savedRecord.id,
    });

    const storedProfile = getStoredProfile();
    const resolution = resolveResultsExport({
      job,
      computedAnalysis,
      resultsResumeContext,
      savedTailoredVersion: savedRecord,
      tailoredDraft: null,
      profileFullName: storedProfile.fullName || profile.fullName,
      profileContact: {
        location: storedProfile.location,
        workPermit: storedProfile.workPermit,
        languages: storedProfile.languages,
      },
    });
    if (resolution.kind !== "ready") return;
    await applyReadyResolution(resolution, tailoredDraftActionIntent);
  }

  function handleRestoreSnapshotAsResumeVersion() {
    if (!computedAnalysis?.resumeSnapshot) return;

    const restored = restoreAnalysisSnapshotAsResumeVersion(computedAnalysis);
    if (!restored) return;

    setContextResumeId(restored.id);
    applyResumeInputToState(snapshotToStoredInput(computedAnalysis.resumeSnapshot));
    setResumeSavedNotice(`Restored "${restored.name}" as a resume version.`);
    logEvent("restore_analysis_snapshot_resume", {
      resumeId: restored.id,
      jobId: job?.id,
    });
  }

  async function handleDraftTailoredResume() {
    if (!job || !analysis || !fitBand || isDraftingTailoredResume || isGeneratingSingleJobAnalysis) {
      return;
    }

    setIsDraftingTailoredResume(true);
    setTailoredDraftFailureOpen(false);
    setTailoredDraftFailureMessage(null);
    setTailoredDraftFailureCode(null);
    logEvent("tailor_resume", { jobId: job.id, jobTitle: job.title });

    const tailorBaseRecord =
      getLatestTailoredResumeForJob(job.id) ??
      resultsResumeContext.record ??
      (contextResumeId ? getResumeRecord(contextResumeId) : null) ??
      getActiveResumeRecord();
    setTailoredDraftSourceResumeId(tailorBaseRecord?.id ?? contextResumeId);
    setTailoredDraftSourceResumeName(
      tailorBaseRecord?.name ?? resultsResumeContext.resumeName ?? null,
    );

    const sourceResumeId = tailorBaseRecord?.id ?? contextResumeId ?? "";
    const existingDraft =
      getPendingTailoredDraftForJobAndSource(job.id, sourceResumeId) ??
      getPendingTailoredDraftForJob(job.id);
    if (existingDraft) {
      setTailoredDraft(pendingToTailoredDraft(existingDraft));
      setTailoredDraftSourceResumeId(existingDraft.sourceResumeId || tailorBaseRecord?.id || null);
      setTailoredDraftSourceResumeName(
        existingDraft.sourceResumeName || tailorBaseRecord?.name || null,
      );
      setTailoredDraftUpdatedAt(existingDraft.updatedAt);
      setShowPendingTailoredDraftBanner(false);
      setTailoredDraftModalOpen(true);
      setIsDraftingTailoredResume(false);
      return;
    }

    const sourceInput = tailorBaseRecord
      ? recordToInput(tailorBaseRecord)
      : resultsResumeContext.input;
    const resumeContext = buildAnalysisResumeContext(sourceInput);

    const draftFingerprint = buildResumeJobContentFingerprint({
      jobDescription: job.description,
      resumeContext,
    });
    const cachedDraft = getTailoredDraftOutputCache(draftFingerprint);
    if (cachedDraft) {
      const cachedMergedInput = mergeTailoredFieldsWithSource(sourceInput, {
        summary: cachedDraft.summary,
        skills: cachedDraft.skills,
        highlights: cachedDraft.highlights,
        education: cachedDraft.education,
      });
      const cachedMergedDraft: TailoredResumeDraft = {
        ...storedInputToDraftFields(cachedMergedInput),
        notes: cachedDraft.notes,
      };
      setTailoredDraft(cachedMergedDraft);
      if (!persistTailoredDraftToStorage(cachedMergedDraft)) {
        setTailoredDraftFailureMessage(
          "Coach Chris drafted your resume but could not save the draft in your browser.",
        );
        setTailoredDraftFailureCode(null);
        setTailoredDraftCanRetry(false);
        setTailoredDraftFailureOpen(true);
        setIsDraftingTailoredResume(false);
        return;
      }
      const cachedPersistedDraft = getPendingTailoredDraftForJob(job.id);
      setTailoredDraftUpdatedAt(cachedPersistedDraft?.updatedAt ?? new Date().toISOString());
      setShowPendingTailoredDraftBanner(false);
      setTailoredDraftModalOpen(true);
      setIsDraftingTailoredResume(false);
      return;
    }

    const result = await runTailoredResumeDraftWithRetry({
      selectedJob: {
        jobId: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        requiredSkills: job.requiredSkills,
      },
      resumeContext,
      analysisContext: {
        fit: analysis.fit,
        score: analysis.score,
        fitSummary: buildFitSummaryLine({
          score: analysis.score,
          fit: analysis.fit,
          fitBand,
        }),
        topStrengths: analysis.strengths.slice(0, 4),
        topGaps: analysis.gaps.slice(0, 4),
        highestPriorityImprovement: topPriorityNextStep,
        missingEvidence: computedAnalysis?.missingEvidence?.slice(0, 5) ?? [],
        riskAreas: analysis.hrView.slice(0, 3),
      },
      sourceResume: tailorBaseRecord
        ? { id: tailorBaseRecord.id, name: tailorBaseRecord.name }
        : undefined,
    });

    setIsDraftingTailoredResume(false);

    if (!result.ok) {
      setTailoredDraftFailureMessage(result.message);
      setTailoredDraftFailureCode(result.code);
      setTailoredDraftCanRetry(result.retryable);
      setTailoredDraftFailureOpen(true);
      logEvent("draft_tailored_resume_failed", {
        jobId: job.id,
        code: result.code,
      });
      return;
    }

    setTailoredDraftOutputCache(draftFingerprint, result.draft);

    const mergedInput = mergeTailoredFieldsWithSource(sourceInput, {
      summary: result.draft.summary,
      skills: result.draft.skills,
      highlights: result.draft.highlights,
      education: result.draft.education,
    });
    const mergedDraft: TailoredResumeDraft = {
      ...storedInputToDraftFields(mergedInput),
      notes: result.draft.notes,
    };

    setTailoredDraft(mergedDraft);
    if (!persistTailoredDraftToStorage(mergedDraft)) {
      setTailoredDraftFailureMessage(
        "Coach Chris drafted your resume but could not save the draft in your browser.",
      );
      setTailoredDraftFailureCode(null);
      setTailoredDraftCanRetry(false);
      setTailoredDraftFailureOpen(true);
      return;
    }
    const persistedDraft = getPendingTailoredDraftForJob(job.id);
    setTailoredDraftUpdatedAt(persistedDraft?.updatedAt ?? new Date().toISOString());
    setShowPendingTailoredDraftBanner(false);
    setTailoredDraftModalOpen(true);
  }

  function handleContinuePendingTailoredDraft() {
    if (!job) return;
    const pending = getPendingTailoredDraftForJob(job.id);
    if (!pending) {
      setShowPendingTailoredDraftBanner(false);
      return;
    }
    setTailoredDraftSourceResumeId(pending.sourceResumeId || null);
    setTailoredDraftSourceResumeName(pending.sourceResumeName || null);
    setTailoredDraftUpdatedAt(pending.updatedAt);
    setTailoredDraft(pendingToTailoredDraft(pending));
    setTailoredDraftModalOpen(true);
    setShowPendingTailoredDraftBanner(false);
  }

  function handleDiscardPendingTailoredDraft() {
    if (job) {
      clearPendingTailoredDraftForJob(job.id);
    }
    setTailoredDraft(null);
    setTailoredDraftSourceResumeName(null);
    setTailoredDraftUpdatedAt(null);
    setShowPendingTailoredDraftBanner(false);
  }

  async function handleRegenerateTailoredDraft() {
    const confirmed = window.confirm("Regenerating will replace your current unsaved draft.");
    if (!confirmed) return;
    if (job) {
      clearPendingTailoredDraftForJob(job.id);
    }
    setTailoredDraft(null);
    setTailoredDraftUpdatedAt(null);
    await handleDraftTailoredResume();
  }

  function handleRetryTailoredDraft() {
    setTailoredDraftFailureOpen(false);
    void handleDraftTailoredResume();
  }

  function handleTryLaterTailoredDraft() {
    setTailoredDraftFailureOpen(false);
    setTailoredDraftFailureMessage(null);
    setTailoredDraftFailureCode(null);
    setTailoredDraftCanRetry(false);
  }

  function handleCancelTailoredDraft() {
    setTailoredDraftModalOpen(false);
    setTailoredDraft(null);
    if (job) {
      setShowPendingTailoredDraftBanner(hasPendingTailoredDraftForJob(job.id));
    }
  }

  const primaryBtnClass =
    "inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryBtnClass =
    "inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

  function renderAnalysisActionRow() {
    if (!job) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleAnalyzeAction(hasReadyFitAnalysis)}
          disabled={isGeneratingSingleJobAnalysis || !hasJobSelected}
          className={hasReadyFitAnalysis ? secondaryBtnClass : primaryBtnClass}
        >
          {isGeneratingSingleJobAnalysis
            ? "Analyzing…"
            : hasReadyFitAnalysis
              ? "Re-run analysis"
              : "Run analysis"}
        </button>
        {analysisFeedbackStatus === "running" ? (
          <span className="text-xs font-medium text-sky-800">
            {ANALYSIS_PROGRESS_STEPS[analysisProgressIndex]}
          </span>
        ) : null}
      </div>
    );
  }

  function renderTailorResumeActions() {
    if (!job) return null;
    return (
      <div className="mt-4 space-y-3 border-t border-rose-200/80 pt-4">
        <p className="text-xs text-rose-900/80">
          Coach Chris will draft changes. You approve before anything is saved.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDraftTailoredResume()}
            disabled={
              isGeneratingSingleJobAnalysis ||
              isDraftingTailoredResume ||
              isSavingTailoredDraft ||
              !hasReadyFitAnalysis
            }
            className={primaryBtnClass}
          >
            {isDraftingTailoredResume
              ? "Tailoring resume…"
              : Boolean(
                  getPendingTailoredDraftForJobAndSource(
                    job.id,
                    resultsResumeContext.record?.id ?? contextResumeId ?? "",
                  ),
                )
                ? "Continue tailored draft"
                : "Tailor my resume"}
          </button>
          {Boolean(
            getPendingTailoredDraftForJobAndSource(
              job.id,
              resultsResumeContext.record?.id ?? contextResumeId ?? "",
            ),
          ) ? (
            <button
              type="button"
              onClick={() => void handleRegenerateTailoredDraft()}
              disabled={isGeneratingSingleJobAnalysis || isDraftingTailoredResume || isSavingTailoredDraft}
              className={secondaryBtnClass}
            >
              Regenerate draft
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              logEvent("edit_resume_manually");
              setShowInlineResumeEditor((open) => !open);
              if (!showInlineResumeEditor) {
                requestAnimationFrame(() => {
                  resumeEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }
            }}
            disabled={isGeneratingSingleJobAnalysis}
            className={secondaryBtnClass}
          >
            {showInlineResumeEditor ? "Hide manual editor" : "Edit manually"}
          </button>
        {optimizeData ? (
          <button
            type="button"
            onClick={() => {
              logEvent("improve_resume");
              setShowInlineOptimize((open) => !open);
              if (!showInlineOptimize) {
                requestAnimationFrame(() => {
                  optimizeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }
            }}
            disabled={isGeneratingSingleJobAnalysis}
            className={secondaryBtnClass}
          >
            {showInlineOptimize ? "Hide optimizer" : "Guided optimizer"}
          </button>
        ) : null}
        </div>
      </div>
    );
  }

  function renderAskChrisAction() {
    if (!job) return null;
    return (
      <div className="mt-4 border-t border-zinc-200 pt-4">
        <AskChrisLink
          prompt={
            analysis
              ? `Should I apply to ${job.title} at ${job.company}? My fit is ${analysis.fit}. Help me decide based on strengths, gaps, and risks.`
              : `Should I apply to ${job.title} at ${job.company}?`
          }
          className={secondaryBtnClass}
        >
          Ask Chris about this role
        </AskChrisLink>
      </div>
    );
  }

  function renderUtilityActions() {
    if (!job) return null;
    return (
      <section className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Resume &amp; navigation
        </h3>
        {resumeSavedNotice ? (
          <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {resumeSavedNotice}
          </p>
        ) : null}
        {showPendingTailoredDraftBanner ? (
          <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            <p>
              {job?.title
                ? `${PENDING_TAILORED_DRAFT_MESSAGE} for ${job.title}.`
                : PENDING_TAILORED_DRAFT_MESSAGE}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleContinuePendingTailoredDraft}
                disabled={isGeneratingSingleJobAnalysis}
                className="font-medium text-sky-950 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Continue editing
              </button>
              <button
                type="button"
                onClick={handleDiscardPendingTailoredDraft}
                disabled={isGeneratingSingleJobAnalysis}
                className="font-medium text-sky-950 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Discard draft
              </button>
            </div>
          </div>
        ) : null}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <button
            type="button"
            onClick={() => router.push("/batch")}
            disabled={isGeneratingSingleJobAnalysis}
            className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline disabled:opacity-50"
          >
            Back to jobs
          </button>
          <span className="text-zinc-300" aria-hidden>
            ·
          </span>
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-zinc-600">Export</span>
            <button
              type="button"
              onClick={() => void exportResume()}
              disabled={isGeneratingSingleJobAnalysis}
              className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline disabled:opacity-50"
            >
              DOCX
            </button>
          </span>
          <span className="text-zinc-300" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => void copyResumeText()}
            disabled={isGeneratingSingleJobAnalysis}
            className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline disabled:opacity-50"
          >
            Copy resume
          </button>
        </p>
        {resultsResumeContext.source === "snapshot-only" ? (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <p>{ANALYSIS_SNAPSHOT_CONTEXT_NOTICE}</p>
            <button
              type="button"
              onClick={handleRestoreSnapshotAsResumeVersion}
              disabled={isGeneratingSingleJobAnalysis}
              className="mt-2 font-medium text-amber-950 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Restore snapshot as resume version
            </button>
          </div>
        ) : null}
        {copyResumeNotice ? <p className="mt-1 text-xs text-zinc-600">{copyResumeNotice}</p> : null}
        {exportResumeNotice ? <p className="mt-1 text-xs text-zinc-600">{exportResumeNotice}</p> : null}
        {!hasResumeInput ? (
          <p className="mt-2 text-xs text-zinc-500">Add your resume on the Resume page to begin.</p>
        ) : null}
        {singleJobContextNotice ? (
          <p className="mt-2 text-xs text-zinc-600">{singleJobContextNotice}</p>
        ) : null}
      </section>
    );
  }

  if (!mounted) {
    return null;
  }

  return (
    <>
      <CoachChrisIntro variant="compact" activeStep={3} showOutcome />
      <PageHeader
        title="Step 3: Resume vs. job fit"
        subtitle="Your resume compared to this role—fit strength, resume gaps, and what to improve before you apply."
      />

      <Step3StatusStrip
        snapshot={resumeWorkspaceSnapshot}
        resumeLabel={analyzedResumeVersionLabel}
        hasReadyFitAnalysis={hasReadyFitAnalysis}
        analysisStatus={analysisFeedbackStatus}
        progressStep={ANALYSIS_PROGRESS_STEPS[analysisProgressIndex]}
        suppressRunningStatus={isGeneratingSingleJobAnalysis}
        analysisResumeName={resultsResumeContext.resumeName}
        activeResumeName={resultsResumeContext.activeResumeName}
      />

      <div className="space-y-6">
        {job && (
          <section className="rounded-xl border border-zinc-200/80 bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <JobActiveBadge variant="active" />
                  {(isGeneratingSingleJobAnalysis ||
                    getPendingAnalysisJobId() === selectedJobId) && (
                    <JobActiveBadge variant="analyzing" />
                  )}
                  {availableJobs.length > 1 ? (
                    <span className="text-xs text-zinc-500">
                      {selectedJobIndex + 1} of {availableJobs.length} saved roles
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 truncate text-base font-semibold text-zinc-900">{job.title}</h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {job.company}
                  {job.location ? ` · ${job.location}` : ""}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Switch roles using Previous/Next, the fit matrix, or{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/batch")}
                    className="font-medium text-zinc-700 underline-offset-2 hover:underline"
                  >
                    Saved jobs
                  </button>
                  . Start a new role with Analyze new job.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/analyze")}
                    disabled={isGeneratingSingleJobAnalysis}
                    className={primaryBtnClass}
                  >
                    Analyze new job
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCurrentJob}
                    disabled={isGeneratingSingleJobAnalysis}
                    className={secondaryBtnClass}
                  >
                    Remove this job
                  </button>
                  {showClearSavedJobs ? (
                    <button
                      type="button"
                      onClick={handleClearSavedJobs}
                      disabled={isGeneratingSingleJobAnalysis}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/80 px-4 py-2 text-sm font-medium text-rose-900 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear saved jobs
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedJobIndex <= 0) return;
                      setSelectedJob(availableJobs[selectedJobIndex - 1].id);
                    }}
                    disabled={selectedJobIndex <= 0 || isGeneratingSingleJobAnalysis}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous job
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedJobIndex < 0 || selectedJobIndex >= availableJobs.length - 1) return;
                      setSelectedJob(availableJobs[selectedJobIndex + 1].id);
                    }}
                    disabled={
                      selectedJobIndex < 0 ||
                      selectedJobIndex >= availableJobs.length - 1 ||
                      isGeneratingSingleJobAnalysis
                    }
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next job
                  </button>
                </div>
              </div>
              <div className="w-full lg:max-w-sm">
                <JobApplicationTracking
                  key={job.id}
                  jobId={job.id}
                  currentStatus={jobStatuses[job.id] ?? (hasReadyFitAnalysis ? "Analyzed" : null)}
                  hasAnalysis={hasReadyFitAnalysis}
                  variant="card"
                  onStatusChange={(next: JobStatus) => {
                    setJobStatuses((prev) => ({ ...prev, [job.id]: next }));
                  }}
                />
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
        {matrixItems.length > 0 ? (
          <div className="space-y-3">
            <FitMatrix
              items={matrixItems}
              selectedJobId={selectedJobId}
              onSelect={setSelectedJob}
              selectionDisabled={isGeneratingSingleJobAnalysis}
            />
            {renderAnalysisActionRow()}
          </div>
        ) : job ? (
          <section className="rounded-xl border border-zinc-200/80 bg-white px-5 py-4">
            <h3 className="text-sm font-medium text-zinc-900">Application summary</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Run analysis to place this role on the fit chart alongside your other jobs.
            </p>
            <div className="mt-3">{renderAnalysisActionRow()}</div>
          </section>
        ) : null}
        {analysis && job && meta && fitBand && resultsBullets ? (
          <div ref={fitResultsRef} id="job-fit-results" className="scroll-mt-24 space-y-6">
            <section className="rounded-xl border-2 border-amber-200 bg-amber-50/90 px-6 py-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Top priority next step
              </h2>
              <p className="mt-1.5 text-sm text-amber-900/90">
                Your best next move for this role—start here, then review the fit details below.
              </p>
              <p className="mt-3 text-lg font-semibold leading-snug text-zinc-900">
                {topPriorityNextStep}
              </p>
            </section>

            {/* Fit summary — score supports the story, not the headline */}
            <section className="rounded-xl border border-zinc-200/80 bg-white px-5 py-4">
              <div className="flex flex-wrap items-start gap-4">
                <CompactFitMeter score={analysis.score} fit={analysis.fit} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-zinc-900">{job.title}</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ""}
                    {job.salaryRange ? ` · ${job.salaryRange}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${fitColor(analysis.fit)}`}
                      title={meta.description}
                    >
                      {analysis.fit}
                    </span>
                    {fitBand ? (
                      <span className="text-xs text-zinc-500">
                        Score {analysis.score} · {fitBand} band
                      </span>
                    ) : null}
                    <span
                      className="text-xs text-zinc-500"
                      title={EVIDENCE_STRENGTH_DISCLAIMER}
                    >
                      {formatEvidenceStrengthShort(confidenceLevel)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {buildFitSummaryLine({
                      score: analysis.score,
                      fit: analysis.fit,
                      fitBand,
                    })}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Analyzed using:{" "}
                    <span className="font-medium text-zinc-700">{analyzedResumeVersionLabel}</span>
                  </p>
                  {encouragingEvidenceInsight ? (
                    <p className="mt-2 text-sm text-sky-900">{encouragingEvidenceInsight}</p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-6 py-6">
              <h2 className="text-base font-bold text-emerald-950">Why this fits</h2>
              {resultsBullets.alignmentStrengths.length > 0 ? (
                <>
                  <p className="mt-1.5 text-sm text-emerald-900/80">
                    Highlights backed by your resume.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {resultsBullets.alignmentStrengths.map((strength) => (
                      <li
                        key={strength}
                        className="flex items-start gap-3 text-sm leading-relaxed text-zinc-800"
                      >
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                          aria-hidden
                        />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-emerald-900/90">
                  No strong alignment signals yet—add clearer resume proof for this role.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200/90 bg-zinc-50/60 px-6 py-6">
              <h2 className="text-base font-bold text-zinc-900">Key gaps</h2>
              <p className="mt-1.5 text-sm text-zinc-600">
                Focused resume updates to tackle one at a time before you apply.
              </p>
              <KeyGapsList gaps={resultsBullets.resumeGaps} fitBand={fitBand} />
              {renderTailorResumeActions()}
            </section>

            <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-6 py-6">
              <h2 className="text-base font-bold text-zinc-900">Coach&apos;s context</h2>
              <p className="mt-1.5 text-sm text-zinc-600">
                Strategic interpretation, hiring risks, and application context beyond resume edits.
              </p>
              {resultsBullets.coachesContext.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {resultsBullets.coachesContext.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm leading-relaxed text-zinc-700"
                    >
                      <span
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-zinc-400"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-zinc-600">
                  No extra strategic context flagged for this role.
                </p>
              )}
              {renderAskChrisAction()}
            </section>

            {showInlineResumeEditor && (
              <section
                ref={resumeEditorRef}
                className="scroll-mt-24 rounded-xl border border-zinc-200/80 bg-white p-5"
              >
                <h3 className="text-base font-semibold text-zinc-900">Edit manually</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Edit the resume version used for this analysis, then save and re-run analysis.
                  For a Coach Chris draft you can review first, use Tailor my resume above.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Editing resume version:{" "}
                  <span className="font-medium text-zinc-700">
                    {analyzedResumeVersionLabel}
                  </span>
                  {" · "}
                  {job.title} at {job.company}
                </p>
                {resultsResumeContext.differsFromActive ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    This analysis used{" "}
                    <span className="font-medium text-zinc-700">
                      {resultsResumeContext.resumeName}
                    </span>
                    . Your current active resume is{" "}
                    <span className="font-medium text-zinc-700">
                      {resultsResumeContext.activeResumeName}
                    </span>
                    .
                  </p>
                ) : null}

                <div className="mt-4 grid gap-4">
                  <div>
                    <label htmlFor="resume-summary-input" className="text-xs font-medium text-zinc-700">
                      Summary
                    </label>
                    <textarea
                      id="resume-summary-input"
                      value={resumeSummaryInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setResumeSummaryInput(value);
                        persistInlineResumeDraft({
                          summary: value,
                          skills: resumeSkillsInput,
                          highlights: resumeHighlightsInput,
                          education: resumeEducationInput,
                        });
                        setCopyResumeNotice(null);
                        setResumeSavedNotice(null);
                      }}
                      placeholder="Add a concise summary tailored to this role"
                      className="mt-1.5 min-h-24 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="resume-skills-input" className="text-xs font-medium text-zinc-700">
                      Skills (comma-separated)
                    </label>
                    <input
                      id="resume-skills-input"
                      type="text"
                      value={resumeSkillsInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setResumeSkillsInput(value);
                        persistInlineResumeDraft({
                          summary: resumeSummaryInput,
                          skills: value,
                          highlights: resumeHighlightsInput,
                          education: resumeEducationInput,
                        });
                        setCopyResumeNotice(null);
                        setResumeSavedNotice(null);
                      }}
                      placeholder="e.g. Product strategy, SQL, experimentation, stakeholder management"
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="resume-highlights-input" className="text-xs font-medium text-zinc-700">
                      Experience (one bullet per line)
                    </label>
                    <textarea
                      id="resume-highlights-input"
                      value={resumeHighlightsInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setResumeHighlightsInput(value);
                        persistInlineResumeDraft({
                          summary: resumeSummaryInput,
                          skills: resumeSkillsInput,
                          highlights: value,
                          education: resumeEducationInput,
                        });
                        setCopyResumeNotice(null);
                        setResumeSavedNotice(null);
                      }}
                      placeholder="Add measurable outcomes and role-specific impact"
                      className="mt-1.5 min-h-32 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="resume-education-input" className="text-xs font-medium text-zinc-700">
                      Education (one entry per line)
                    </label>
                    <textarea
                      id="resume-education-input"
                      value={resumeEducationInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setResumeEducationInput(value);
                        persistInlineResumeDraft({
                          summary: resumeSummaryInput,
                          skills: resumeSkillsInput,
                          highlights: resumeHighlightsInput,
                          education: value,
                        });
                        setCopyResumeNotice(null);
                        setResumeSavedNotice(null);
                      }}
                      placeholder="Degree, school, and dates on separate lines"
                      className="mt-1.5 min-h-24 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveResumeOnly}
                    disabled={isGeneratingSingleJobAnalysis}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save resume updates
                  </button>
                </div>
              </section>
            )}

          </div>
        ) : job && !hasReadyFitAnalysis ? (
          <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
            <h3 className="text-sm font-medium text-zinc-900">{job.title}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {job.company} · {job.location}
              {job.salaryRange && <span> · {job.salaryRange}</span>}
            </p>
            <p className="mt-3 text-sm text-zinc-600">
              {needsLegacyReanalysis
                ? "This job was saved before analysis was stored. Run analysis to get a fit score, evidence strength, and gaps."
                : computedAnalysis?.analysisState === "insufficient_evidence"
                ? "This may still be a good fit—your resume needs more evidence on the page to show it clearly."
                : "Run analysis once to get a fit score, evidence strength, and gaps for this role."}
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
            {matrixItems.length === 0 ? (
              <div className="mt-4">{renderAnalysisActionRow()}</div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
            <h3 className="text-sm font-medium text-zinc-900">Selected job required</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Select a saved job to view details and run analysis.
            </p>
          </section>
        )}

        {job ? renderUtilityActions() : null}

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

      </div>

      <AnalysisFailureModal
        open={analysisFeedbackStatus === "failed"}
        message={analysisFeedbackMessage}
        failureCode={analysisFailureCode}
        canRetry={analysisCanRetry}
        onRetryNow={handleRetryAnalysis}
        onRunLater={handleRunAnalysisLater}
      />

      <TailoredResumeDraftModal
        open={tailoredDraftModalOpen}
        jobTitle={job?.title ?? "this role"}
        company={job?.company ?? "this company"}
        sourceResumeName={tailoredDraftSourceResumeName}
        lastUpdatedAt={tailoredDraftUpdatedAt}
        draft={tailoredDraft}
        isSaving={isSavingTailoredDraft}
        isRerunningAnalysis={isRerunningAfterTailoredSave}
        onSaveAndRerunAnalysis={(draft) => void handleSaveAndRerunTailoredDraft(draft)}
        onSaveWithoutRerun={(draft) => void handleSaveTailoredDraftWithoutRerun(draft)}
        onDraftChange={persistTailoredDraftToStorage}
        onDiscardDraft={handleDiscardPendingTailoredDraft}
        onCancel={handleCancelTailoredDraft}
      />

      <TailoredResumeDraftFailureModal
        open={tailoredDraftFailureOpen}
        message={tailoredDraftFailureMessage}
        failureCode={tailoredDraftFailureCode}
        canRetry={tailoredDraftCanRetry}
        onRetryNow={handleRetryTailoredDraft}
        onTryLater={handleTryLaterTailoredDraft}
      />

      <ExportTailoredDraftDialog
        open={exportTailoredDraftDialogOpen}
        intent={tailoredDraftActionIntent}
        isSaving={isSavingTailoredDraft}
        onSaveAndPrimary={() => void handleSaveAndApplyTailoredDraft()}
        onUseSavedVersion={() => void handleApplySavedVersionFromPrompt()}
        onCancel={() => setExportTailoredDraftDialogOpen(false)}
      />

      <ClearAllJobsConfirmDialog
        open={clearSavedJobsDialogOpen}
        title="Clear saved jobs?"
        confirmLabel="Clear saved jobs"
        onCancel={() => setClearSavedJobsDialogOpen(false)}
        onConfirm={handleConfirmClearSavedJobs}
      />

      <RemoveJobConfirmDialog
        open={removeJobDialogOpen}
        jobTitle={job?.title ?? "this job"}
        onCancel={() => setRemoveJobDialogOpen(false)}
        onConfirm={handleConfirmRemoveCurrentJob}
      />

      {isGeneratingSingleJobAnalysis && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-5"
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          aria-labelledby="analysis-progress-title"
        >
          <section className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg">
            <p id="analysis-progress-title" className="text-sm font-medium text-zinc-900">
              Analyzing job fit
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-700">
              {ANALYSIS_PROGRESS_STEPS[analysisProgressIndex]}
            </p>
            <ul className="mt-3 space-y-1.5" aria-label="Analysis progress">
              {ANALYSIS_PROGRESS_STEPS.map((step, index) => (
                <li
                  key={step}
                  className={`text-xs ${
                    index <= analysisProgressIndex ? "font-medium text-zinc-800" : "text-zinc-400"
                  }`}
                >
                  {step}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              {job
                ? `Analyzing ${job.title} at ${job.company}. Your resume and job details stay saved.`
                : "Your resume and job details stay saved while Chris works."}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Analyze and re-run stay disabled until this finishes.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
