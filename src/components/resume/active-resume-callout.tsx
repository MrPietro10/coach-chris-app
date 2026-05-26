"use client";

import Link from "next/link";
import { getResumeWorkspaceHints, type ResumeWorkspaceSnapshot } from "@/lib/resume-workspace";

type ActiveResumeCalloutProps = {
  snapshot: ResumeWorkspaceSnapshot;
  inAnalysisContext?: boolean;
};

export function ActiveResumeCallout({
  snapshot,
  inAnalysisContext = false,
}: ActiveResumeCalloutProps) {
  const hints = getResumeWorkspaceHints(snapshot, { inAnalysisContext });

  if (!hints.previewText && !hints.isSavedForAnalysis && !hints.needsParseReview) {
    return null;
  }

  const isActive = hints.isActiveForAnalysis || (hints.isSavedForAnalysis && !hints.hasUnsavedEdits);

  return (
    <div
      className={`mt-4 rounded-lg border px-3 py-2.5 text-xs ${
        isActive
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
          : "border-amber-200 bg-amber-50/80 text-amber-950"
      }`}
      role="status"
    >
      <p className="font-semibold">
        {isActive
          ? "Active resume for this analysis."
          : "This resume is not saved for analysis yet."}
      </p>
      {snapshot.activeResumeName ? (
        <p className="mt-0.5 text-[11px] font-medium opacity-90">{snapshot.activeResumeName}</p>
      ) : null}
      {hints.previewText ? (
        <p className="mt-1 text-[11px] opacity-90">{hints.previewText}</p>
      ) : null}
      {snapshot.upload?.fileName ? (
        <p className="mt-1 text-[11px] opacity-80">Source file: {snapshot.upload.fileName}</p>
      ) : null}
      {hints.hasUnsavedEdits ? (
        <p className="mt-1 font-medium">Unsaved edits — save to update what analysis uses.</p>
      ) : null}
      {hints.needsParseReview ? (
        <p className="mt-1">
          New resume needs confirmation before analysis.{" "}
          <Link href="/resume" className="font-medium underline-offset-2 hover:underline">
            Review on Resume
          </Link>
        </p>
      ) : null}
    </div>
  );
}
