"use client";

import { useState } from "react";
import {
  getResumeParseFeedbackForSession,
  recordResumeParseFeedback,
  type ResumeParseFeedbackRating,
} from "@/lib/resume-parse-feedback";

type ResumeParseFeedbackProps = {
  parsedAt: string | null;
  fileType?: "pdf" | "docx";
  fileName?: string | null;
};

export function ResumeParseFeedback({
  parsedAt,
  fileType,
  fileName,
}: ResumeParseFeedbackProps) {
  const existing = parsedAt ? getResumeParseFeedbackForSession(parsedAt) : null;
  const [submitted, setSubmitted] = useState<ResumeParseFeedbackRating | null>(existing);

  if (!parsedAt) {
    return null;
  }

  function handleRating(rating: ResumeParseFeedbackRating): void {
    if (!parsedAt) return;
    recordResumeParseFeedback({
      rating,
      parsedAt,
      fileType,
      fileName: fileName ?? undefined,
    });
    setSubmitted(rating);
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
      <p className="text-xs font-medium text-zinc-800">Was this parsed correctly?</p>
      {submitted ? (
        <p className="mt-1.5 text-xs text-zinc-600">
          Thanks — your feedback helps improve parsing.
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRating("up")}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            aria-label="Parsing was correct"
          >
            <span aria-hidden>👍</span>
            Yes
          </button>
          <button
            type="button"
            onClick={() => handleRating("down")}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            aria-label="Parsing was incorrect"
          >
            <span aria-hidden>👎</span>
            No
          </button>
        </div>
      )}
    </div>
  );
}
