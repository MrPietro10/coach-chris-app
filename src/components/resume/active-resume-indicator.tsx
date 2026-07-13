"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ALPHA_SESSION_CHANGED_EVENT } from "@/lib/alpha-session-store";
import {
  formatResumeDateShort,
} from "@/lib/resume-version-display";
import {
  getResumePersistenceState,
  RESUME_STORAGE_CHANGED_EVENT,
} from "@/lib/job-session-store";
import { buildResumePreviewText, hasResumeFieldContent } from "@/lib/resume-workspace";

export function ActiveResumeIndicator() {
  const [persistence, setPersistence] = useState(() =>
    typeof window === "undefined"
      ? {
          activeResumeId: null,
          activeResumeName: null,
          input: { summary: "", skills: "", highlights: "", education: "" },
          upload: null,
          savedAt: null,
          parsedAt: null,
          createdAt: null,
          updatedAt: null,
          sourceFileName: null,
          isSavedForAnalysis: false,
          needsParseReview: false,
        }
      : getResumePersistenceState(),
  );

  useEffect(() => {
    const refresh = () => setPersistence(getResumePersistenceState());
    window.addEventListener(RESUME_STORAGE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(RESUME_STORAGE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
    };
  }, []);

  if (!hasResumeFieldContent(persistence.input)) {
    return (
      <p className="hidden text-[11px] text-zinc-500 lg:block">
        No active resume —{" "}
        <Link href="/resume" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
          add resume
        </Link>
      </p>
    );
  }

  const preview = buildResumePreviewText(persistence.input);
  const updatedShort = formatResumeDateShort(persistence.updatedAt);

  return (
    <p
      className="hidden max-w-xs truncate text-[11px] text-zinc-600 lg:block"
      title={[preview, updatedShort ? `Last updated ${updatedShort}` : null].filter(Boolean).join(" · ")}
    >
      {persistence.isSavedForAnalysis ? (
        <span className="font-medium text-emerald-800">Active resume for this analysis:</span>
      ) : (
        <span className="font-medium text-amber-800">Resume draft (not saved for analysis):</span>
      )}{" "}
      {(persistence.activeResumeName ?? preview) || "In progress"}
      {persistence.upload?.fileName ? (
        <span className="text-zinc-500"> · {persistence.upload.fileName}</span>
      ) : null}
      {updatedShort ? <span className="text-zinc-500"> · updated {updatedShort}</span> : null}
    </p>
  );
}
