"use client";

import { useState } from "react";
import type { TailoredResumeDraft } from "@/lib/tailored-resume-draft";

type TailoredResumeDraftModalProps = {
  open: boolean;
  jobTitle: string;
  company: string;
  sourceResumeName?: string | null;
  lastUpdatedAt?: string | null;
  draft: TailoredResumeDraft | null;
  isSaving?: boolean;
  isRerunningAnalysis?: boolean;
  onSaveAndRerunAnalysis: (draft: TailoredResumeDraft) => void;
  onSaveWithoutRerun: (draft: TailoredResumeDraft) => void;
  onDraftChange?: (draft: TailoredResumeDraft) => void;
  onDiscardDraft: () => void;
  onCancel: () => void;
};

type TailoredResumeDraftModalBodyProps = {
  jobTitle: string;
  company: string;
  sourceResumeName?: string | null;
  lastUpdatedAt?: string | null;
  initialDraft: TailoredResumeDraft;
  isSaving: boolean;
  isRerunningAnalysis: boolean;
  onSaveAndRerunAnalysis: (draft: TailoredResumeDraft) => void;
  onSaveWithoutRerun: (draft: TailoredResumeDraft) => void;
  onDraftChange?: (draft: TailoredResumeDraft) => void;
  onDiscardDraft: () => void;
  onCancel: () => void;
};

function TailoredResumeDraftModalBody({
  jobTitle,
  company,
  sourceResumeName,
  lastUpdatedAt,
  initialDraft,
  isSaving,
  isRerunningAnalysis,
  onSaveAndRerunAnalysis,
  onSaveWithoutRerun,
  onDraftChange,
  onDiscardDraft,
  onCancel,
}: TailoredResumeDraftModalBodyProps) {
  const [fields, setFields] = useState(initialDraft);
  const updatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString()
    : null;

  const handleFieldChange = (next: TailoredResumeDraft) => {
    setFields(next);
    onDraftChange?.(next);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 px-5 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tailored-draft-title"
      aria-describedby="tailored-draft-description"
    >
      <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 id="tailored-draft-title" className="text-lg font-semibold text-zinc-900">
            Review tailored resume draft
          </h2>
          <p id="tailored-draft-description" className="mt-1 text-sm text-zinc-600">
            Coach Chris drafted this version for {jobTitle} at {company}. Review and edit before saving.
          </p>
          <div className="mt-2 space-y-1 text-xs text-zinc-500">
            <p>Source resume: {sourceResumeName?.trim() || "Current resume"}</p>
            {updatedLabel ? <p>Last updated: {updatedLabel}</p> : null}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {fields.notes.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-900">Coach notes</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-950">
                {fields.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <label htmlFor="tailored-draft-summary" className="text-xs font-medium text-zinc-700">
              Summary
            </label>
            <textarea
              id="tailored-draft-summary"
              value={fields.summary}
              onChange={(event) =>
                handleFieldChange({ ...fields, summary: event.target.value })
              }
              className="mt-1.5 min-h-24 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            />
          </div>

          <div>
            <label htmlFor="tailored-draft-skills" className="text-xs font-medium text-zinc-700">
              Skills
            </label>
            <input
              id="tailored-draft-skills"
              type="text"
              value={fields.skills}
              onChange={(event) => handleFieldChange({ ...fields, skills: event.target.value })}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            />
          </div>

          <div>
            <label htmlFor="tailored-draft-experience" className="text-xs font-medium text-zinc-700">
              Experience
            </label>
            <textarea
              id="tailored-draft-experience"
              value={fields.highlights}
              onChange={(event) =>
                handleFieldChange({ ...fields, highlights: event.target.value })
              }
              className="mt-1.5 min-h-32 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            />
          </div>

          <div>
            <label htmlFor="tailored-draft-education" className="text-xs font-medium text-zinc-700">
              Education
            </label>
            <textarea
              id="tailored-draft-education"
              value={fields.education}
              onChange={(event) =>
                handleFieldChange({ ...fields, education: event.target.value })
              }
              className="mt-1.5 min-h-20 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            disabled={isSaving || isRerunningAnalysis}
            onClick={() => onSaveAndRerunAnalysis(fields)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving…"
              : isRerunningAnalysis
                ? "Re-running analysis…"
                : "Save and re-run analysis"}
          </button>
          <button
            type="button"
            disabled={isSaving || isRerunningAnalysis}
            onClick={() => onSaveWithoutRerun(fields)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save without re-running
          </button>
          <button
            type="button"
            disabled={isSaving || isRerunningAnalysis}
            onClick={onDiscardDraft}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            Discard draft
          </button>
          <button
            type="button"
            disabled={isSaving || isRerunningAnalysis}
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

function buildDraftKey(draft: TailoredResumeDraft): string {
  return [draft.summary, draft.skills, draft.highlights, draft.education, draft.notes.join("|")].join(
    "\u0000",
  );
}

export function TailoredResumeDraftModal({
  open,
  jobTitle,
  company,
  sourceResumeName,
  lastUpdatedAt,
  draft,
  isSaving = false,
  isRerunningAnalysis = false,
  onSaveAndRerunAnalysis,
  onSaveWithoutRerun,
  onDraftChange,
  onDiscardDraft,
  onCancel,
}: TailoredResumeDraftModalProps) {
  if (!open || !draft) {
    return null;
  }

  return (
    <TailoredResumeDraftModalBody
      key={buildDraftKey(draft)}
      jobTitle={jobTitle}
      company={company}
      sourceResumeName={sourceResumeName}
      lastUpdatedAt={lastUpdatedAt}
      initialDraft={draft}
      isSaving={isSaving}
      isRerunningAnalysis={isRerunningAnalysis}
      onSaveAndRerunAnalysis={onSaveAndRerunAnalysis}
      onSaveWithoutRerun={onSaveWithoutRerun}
      onDraftChange={onDraftChange}
      onDiscardDraft={onDiscardDraft}
      onCancel={onCancel}
    />
  );
}
