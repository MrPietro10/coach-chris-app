"use client";

import { useState } from "react";
import type { StoredResumeInput } from "@/lib/job-session-store";

export type ResumeParseConfirmMode = "accepted" | "corrected";

type ResumeParseReviewModalProps = {
  open: boolean;
  draft: StoredResumeInput | null;
  onConfirm: (fields: StoredResumeInput, mode: ResumeParseConfirmMode) => void;
  onEditStarted: () => void;
  onDismiss: () => void;
};

type ResumeParseReviewContentProps = {
  draft: StoredResumeInput;
  onConfirm: (fields: StoredResumeInput, mode: ResumeParseConfirmMode) => void;
  onEditStarted: () => void;
  onDismiss: () => void;
};

function ResumeParseReviewContent({
  draft,
  onConfirm,
  onEditStarted,
  onDismiss,
}: ResumeParseReviewContentProps) {
  const [phase, setPhase] = useState<"review" | "editing">("review");
  const [summary, setSummary] = useState(draft.summary);
  const [skills, setSkills] = useState(draft.skills);
  const [highlights, setHighlights] = useState(draft.highlights);
  const [education, setEducation] = useState(draft.education);

  function buildConfirmedFields(): StoredResumeInput {
    return {
      summary: summary.trim(),
      skills: skills.trim(),
      highlights: highlights.trim(),
      education: education.trim(),
    };
  }

  const hasContent =
    summary.trim().length > 0 ||
    skills.trim().length > 0 ||
    highlights.trim().length > 0 ||
    education.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-parse-review-title"
    >
      <section className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 id="resume-parse-review-title" className="text-lg font-semibold text-zinc-900">
            Review your resume
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Check that we captured your summary, skills, experience, and education correctly.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="review-resume-summary" className="text-xs font-medium text-zinc-700">
                Summary
              </label>
              <textarea
                id="review-resume-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="mt-1 min-h-24 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              />
            </div>
            <div>
              <label htmlFor="review-resume-skills" className="text-xs font-medium text-zinc-700">
                Skills
              </label>
              <input
                id="review-resume-skills"
                type="text"
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              />
            </div>
            <div>
              <label htmlFor="review-resume-highlights" className="text-xs font-medium text-zinc-700">
                Experience
              </label>
              <textarea
                id="review-resume-highlights"
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
                className="mt-1 min-h-28 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm leading-relaxed text-zinc-800"
              />
            </div>
            <div>
              <label htmlFor="review-resume-education" className="text-xs font-medium text-zinc-700">
                Education
              </label>
              <textarea
                id="review-resume-education"
                value={education}
                onChange={(event) => setEducation(event.target.value)}
                placeholder="One degree or school per line"
                className="mt-1 min-h-20 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm leading-relaxed text-zinc-800"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-5 py-4">
          {phase === "review" ? (
            <>
              <button
                type="button"
                onClick={() => onConfirm(buildConfirmedFields(), "accepted")}
                disabled={!hasContent}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Looks good — use this resume
              </button>
              <button
                type="button"
                onClick={() => {
                  onEditStarted();
                  setPhase("editing");
                }}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
              >
                Edit before continuing
              </button>
            </>
          ) : (
            <>
              <p className="w-full text-xs text-zinc-500">
                Make any changes above, then continue.
              </p>
              <button
                type="button"
                onClick={() => onConfirm(buildConfirmedFields(), "corrected")}
                disabled={!hasContent}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Use edited resume
              </button>
              <button
                type="button"
                onClick={() => setPhase("review")}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Back
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto text-sm font-medium text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

export function ResumeParseReviewModal({
  open,
  draft,
  onConfirm,
  onEditStarted,
  onDismiss,
}: ResumeParseReviewModalProps) {
  if (!open || !draft) {
    return null;
  }

  return (
    <ResumeParseReviewContent
      key={`${draft.summary}-${draft.skills}-${draft.highlights}-${draft.education}`}
      draft={draft}
      onConfirm={onConfirm}
      onEditStarted={onEditStarted}
      onDismiss={onDismiss}
    />
  );
}
