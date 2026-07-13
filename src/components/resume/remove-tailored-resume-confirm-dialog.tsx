"use client";

type RemoveTailoredResumeConfirmDialogProps = {
  open: boolean;
  resumeName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RemoveTailoredResumeConfirmDialog({
  open,
  resumeName,
  onConfirm,
  onCancel,
}: RemoveTailoredResumeConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-tailored-resume-title"
      aria-describedby="remove-tailored-resume-description"
    >
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 id="remove-tailored-resume-title" className="text-lg font-semibold text-zinc-900">
          Remove this tailored resume?
        </h2>
        <p id="remove-tailored-resume-description" className="mt-2 text-sm text-zinc-600">
          This deletes <span className="font-medium text-zinc-800">{resumeName}</span> from your
          saved resume versions. Your other resume versions will not be changed.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Remove tailored resume
          </button>
        </div>
      </section>
    </div>
  );
}
