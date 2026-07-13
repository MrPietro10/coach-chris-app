"use client";

import Link from "next/link";
import { getResumeWorkspaceHints, type ResumeWorkspaceSnapshot } from "@/lib/resume-workspace";

type ActiveResumeCalloutProps = {
  snapshot: ResumeWorkspaceSnapshot;
  inAnalysisContext?: boolean;
  variant?: "default" | "compact";
};

export function ActiveResumeCallout({
  snapshot,
  inAnalysisContext = false,
  variant = "default",
}: ActiveResumeCalloutProps) {
  const hints = getResumeWorkspaceHints(snapshot, { inAnalysisContext });
  const isCompact = variant === "compact";

  const showStatus =
    hints.hasUnsavedEdits ||
    hints.needsParseReview ||
    (!hints.isSavedForAnalysis && hints.previewText) ||
    (isCompact && hints.isSavedForAnalysis && !hints.hasUnsavedEdits);

  if (!showStatus && !hints.previewText) {
    return null;
  }

  const isReady = hints.isSavedForAnalysis && !hints.hasUnsavedEdits && !hints.needsParseReview;

  const containerClass = isCompact
    ? isReady
      ? "mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-700"
      : hints.needsParseReview || hints.hasUnsavedEdits
        ? "mt-3 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-xs text-amber-950"
        : "mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-700"
    : isReady
      ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950"
      : "mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950";

  return (
    <div className={containerClass} role="status">
      {isCompact ? (
        isReady ? (
          <p className="text-[11px] text-zinc-600">
            <span className="font-medium text-zinc-800">Using resume:</span>
            {snapshot.activeResumeName ? ` ${snapshot.activeResumeName}` : null}
          </p>
        ) : null
      ) : (
        <p className="font-semibold">
          {isReady
            ? "Active resume for this analysis."
            : "This resume is not saved for analysis yet."}
        </p>
      )}

      {!isCompact && snapshot.activeResumeName ? (
        <p className="mt-0.5 text-[11px] font-medium opacity-90">{snapshot.activeResumeName}</p>
      ) : null}

      {hints.previewText && !isCompact ? (
        <p className="mt-1 text-[11px] opacity-90">{hints.previewText}</p>
      ) : null}

      {hints.hasUnsavedEdits ? (
        <p className={`${isCompact ? "" : "mt-1"} font-medium`}>
          Unsaved edits — save to update what analysis uses.
        </p>
      ) : null}

      {hints.needsParseReview ? (
        <p className={isCompact ? "mt-1" : "mt-1"}>
          New resume needs confirmation before analysis.{" "}
          <Link href="/resume" className="font-medium underline-offset-2 hover:underline">
            Review on Resume
          </Link>
        </p>
      ) : null}
    </div>
  );
}
