"use client";

import Link from "next/link";
import { getResumeWorkspaceHints, type ResumeWorkspaceSnapshot } from "@/lib/resume-workspace";

type ResumeWorkspaceStatusProps = {
  snapshot: ResumeWorkspaceSnapshot;
  inAnalysisContext?: boolean;
};

/** Lightweight resume context for Results — only shows messages tied to real events. */
export function ResumeWorkspaceStatus({
  snapshot,
  inAnalysisContext = false,
}: ResumeWorkspaceStatusProps) {
  const hints = getResumeWorkspaceHints(snapshot, { inAnalysisContext });

  if (!hints.previewText && !hints.isSavedForAnalysis && !hints.needsParseReview) {
    return (
      <p className="text-xs text-zinc-600">
        No resume saved yet.{" "}
        <Link href="/resume" className="font-medium text-zinc-800 underline-offset-2 hover:underline">
          Add your resume
        </Link>
      </p>
    );
  }

  return (
    <div className="text-xs text-zinc-600">
      {hints.previewText ? (
        <p>
          <span className="font-medium text-zinc-800">Resume for analysis:</span> {hints.previewText}
        </p>
      ) : null}
      {snapshot.upload?.fileName ? (
        <p className="mt-1 text-zinc-500">From file: {snapshot.upload.fileName}</p>
      ) : null}
      {hints.isActiveForAnalysis ? (
        <p className="mt-1 text-emerald-800">This saved resume is used for the current job analysis.</p>
      ) : hints.isSavedForAnalysis && !hints.hasUnsavedEdits ? (
        <p className="mt-1 text-emerald-800">Saved — used when you run job analysis.</p>
      ) : null}
      {hints.needsParseReview ? (
        <p className="mt-1 text-amber-800">
          Parsed resume not saved yet.{" "}
          <Link href="/resume" className="font-medium underline-offset-2 hover:underline">
            Review and save
          </Link>
        </p>
      ) : null}
      {hints.hasUnsavedEdits ? (
        <p className="mt-1 text-amber-800">Unsaved edits — save or re-run analysis to apply.</p>
      ) : null}
      <Link
        href="/resume"
        className="mt-2 inline-flex font-medium text-zinc-800 underline-offset-2 hover:underline"
      >
        Edit resume
      </Link>
    </div>
  );
}
