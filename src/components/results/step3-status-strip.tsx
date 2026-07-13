"use client";

import Link from "next/link";
import type { AnalysisFeedbackStatus } from "@/components/results/analysis-feedback-banner";
import { getResumeWorkspaceHints, type ResumeWorkspaceSnapshot } from "@/lib/resume-workspace";

type Step3StatusStripProps = {
  snapshot: ResumeWorkspaceSnapshot;
  resumeLabel: string | null;
  hasReadyFitAnalysis: boolean;
  analysisStatus: AnalysisFeedbackStatus;
  progressStep?: string;
  /** Hide in-strip running copy when the full-screen progress modal is open. */
  suppressRunningStatus?: boolean;
  analysisResumeName?: string | null;
  activeResumeName?: string | null;
};

export function Step3StatusStrip({
  snapshot,
  resumeLabel,
  hasReadyFitAnalysis,
  analysisStatus,
  progressStep,
  suppressRunningStatus = false,
  analysisResumeName,
  activeResumeName,
}: Step3StatusStripProps) {
  const showActiveMismatch =
    Boolean(analysisResumeName?.trim()) &&
    Boolean(activeResumeName?.trim()) &&
    analysisResumeName?.trim() !== activeResumeName?.trim();
  const hints = getResumeWorkspaceHints(snapshot, { inAnalysisContext: hasReadyFitAnalysis });
  const showAnalysisComplete = hasReadyFitAnalysis || analysisStatus === "success";
  const showAnalysisRunning = analysisStatus === "running" && !suppressRunningStatus;
  const showResumeLine =
    Boolean(resumeLabel?.trim()) &&
    hints.isSavedForAnalysis &&
    !hints.hasUnsavedEdits &&
    !hints.needsParseReview;

  const hasWarnings =
    hints.hasUnsavedEdits ||
    hints.needsParseReview ||
    (!hints.isSavedForAnalysis && Boolean(hints.previewText));

  if (
    !showResumeLine &&
    !showAnalysisComplete &&
    !showAnalysisRunning &&
    !hasWarnings &&
    !showActiveMismatch
  ) {
    return null;
  }

  return (
    <div
      className="mb-4 space-y-1 border-b border-zinc-100 pb-3 text-xs text-zinc-600"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {showResumeLine ? (
        <p>
          <span className="font-medium text-zinc-700">Using resume:</span> {resumeLabel}
        </p>
      ) : null}

      {showActiveMismatch ? (
        <p className="text-zinc-500">
          This analysis used{" "}
          <span className="font-medium text-zinc-700">{analysisResumeName}</span>. Your current
          active resume is{" "}
          <span className="font-medium text-zinc-700">{activeResumeName}</span>.
        </p>
      ) : null}

      {showAnalysisComplete ? (
        <p className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span className="font-medium text-zinc-700">Analysis complete</span>
        </p>
      ) : null}

      {showAnalysisRunning ? (
        <p className="flex items-center gap-1.5 text-sky-800">
          <span
            className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          <span className="font-medium">{progressStep ?? "Analysis running…"}</span>
        </p>
      ) : null}

      {hints.hasUnsavedEdits ? (
        <p className="text-amber-900">
          Unsaved resume edits — save on the Resume page before re-running analysis.
        </p>
      ) : null}

      {hints.needsParseReview ? (
        <p className="text-amber-900">
          New resume needs confirmation before analysis.{" "}
          <Link href="/resume" className="font-medium underline-offset-2 hover:underline">
            Review on Resume
          </Link>
        </p>
      ) : null}

      {!hints.isSavedForAnalysis && hints.previewText && !hints.needsParseReview ? (
        <p className="text-amber-900">
          Resume not saved for analysis yet.{" "}
          <Link href="/resume" className="font-medium underline-offset-2 hover:underline">
            Save on Resume
          </Link>
        </p>
      ) : null}
    </div>
  );
}
