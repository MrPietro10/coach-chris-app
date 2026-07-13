"use client";

import { useState } from "react";

export type ClearAllJobsConfirmOptions = {
  removeLinkedTailoredResumes: boolean;
};

type ClearAllJobsConfirmDialogProps = {
  open: boolean;
  title?: string;
  confirmLabel?: string;
  onConfirm: (options: ClearAllJobsConfirmOptions) => void;
  onCancel: () => void;
};

export function ClearAllJobsConfirmDialog({
  open,
  title = "Clear all jobs?",
  confirmLabel = "Clear all jobs",
  onConfirm,
  onCancel,
}: ClearAllJobsConfirmDialogProps) {
  const [removeLinkedTailoredResumes, setRemoveLinkedTailoredResumes] = useState(false);

  if (!open) {
    return null;
  }

  function handleCancel(): void {
    setRemoveLinkedTailoredResumes(false);
    onCancel();
  }

  function handleConfirm(): void {
    onConfirm({ removeLinkedTailoredResumes });
    setRemoveLinkedTailoredResumes(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-all-jobs-title"
      aria-describedby="clear-all-jobs-description"
    >
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 id="clear-all-jobs-title" className="text-lg font-semibold text-zinc-900">
          {title}
        </h2>
        <p id="clear-all-jobs-description" className="mt-2 text-sm text-zinc-600">
          This clears jobs and analyses. Resume versions will stay saved.
        </p>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={removeLinkedTailoredResumes}
            onChange={(event) => setRemoveLinkedTailoredResumes(event.target.checked)}
          />
          <span>Also remove tailored resumes linked to these jobs</span>
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
