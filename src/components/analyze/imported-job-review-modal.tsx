"use client";

import { useState } from "react";
import { ImportParseFeedback } from "@/components/import/import-parse-feedback";
import { recordJobImportFeedback } from "@/lib/job-import-feedback";

export type ImportedJobDraft = {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  importedAt: string;
};

type ImportedJobReviewModalProps = {
  open: boolean;
  draft: ImportedJobDraft | null;
  onConfirm: (draft: ImportedJobDraft) => void;
  onDismiss: () => void;
};

type ImportedJobReviewContentProps = {
  draft: ImportedJobDraft;
  onConfirm: (draft: ImportedJobDraft) => void;
  onDismiss: () => void;
};

function ImportedJobReviewContent({
  draft,
  onConfirm,
  onDismiss,
}: ImportedJobReviewContentProps) {
  const [phase, setPhase] = useState<"review" | "editing">("review");
  const [title, setTitle] = useState(draft.title);
  const [company, setCompany] = useState(draft.company);
  const [location, setLocation] = useState(draft.location);
  const [description, setDescription] = useState(draft.description);

  function buildConfirmedDraft(): ImportedJobDraft {
    return {
      title: title.trim() || "Untitled job",
      company: company.trim() || "Unknown company",
      location: location.trim(),
      description: description.trim(),
      sourceUrl: draft.sourceUrl,
      importedAt: draft.importedAt,
    };
  }

  function handleConfirm(): void {
    onConfirm(buildConfirmedDraft());
  }

  function handleFeedback(rating: "up" | "down", comment?: string): void {
    recordJobImportFeedback({
      rating,
      importedAt: draft.importedAt,
      comment,
      sourceUrl: draft.sourceUrl,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imported-job-review-title"
    >
      <section className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 id="imported-job-review-title" className="text-lg font-semibold text-zinc-900">
            Review imported job
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Coach Chris found this job information. Review it before continuing.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="review-job-title" className="text-xs font-medium text-zinc-700">
                Job title
              </label>
              <input
                id="review-job-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              />
            </div>
            <div>
              <label htmlFor="review-job-company" className="text-xs font-medium text-zinc-700">
                Company
              </label>
              <input
                id="review-job-company"
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              />
            </div>
            <div>
              <label htmlFor="review-job-location" className="text-xs font-medium text-zinc-700">
                Location
              </label>
              <input
                id="review-job-location"
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="review-job-description" className="text-xs font-medium text-zinc-700">
                Job description
              </label>
              <textarea
                id="review-job-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 min-h-40 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm leading-relaxed text-zinc-800"
              />
            </div>
          </div>

          <ImportParseFeedback
            question="Did Coach Chris import this correctly?"
            onSubmit={handleFeedback}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-5 py-4">
          {phase === "review" ? (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={description.trim().length === 0}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Looks good — use this job
              </button>
              <button
                type="button"
                onClick={() => setPhase("editing")}
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
                onClick={handleConfirm}
                disabled={description.trim().length === 0}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Use edited job
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

export function ImportedJobReviewModal({
  open,
  draft,
  onConfirm,
  onDismiss,
}: ImportedJobReviewModalProps) {
  if (!open || !draft) {
    return null;
  }

  return (
    <ImportedJobReviewContent
      key={draft.importedAt}
      draft={draft}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
}
