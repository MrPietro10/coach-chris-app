"use client";

type JobUrlImportFailureModalProps = {
  open: boolean;
  title: string;
  message: string;
  onPasteManually: () => void;
  onTryAnotherLink: () => void;
  onCancel: () => void;
};

export function JobUrlImportFailureModal({
  open,
  title,
  message,
  onPasteManually,
  onTryAnotherLink,
  onCancel,
}: JobUrlImportFailureModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-url-import-failure-title"
      aria-describedby="job-url-import-failure-description"
    >
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 id="job-url-import-failure-title" className="text-lg font-semibold text-zinc-900">
          {title}
        </h2>
        <p id="job-url-import-failure-description" className="mt-2 text-sm text-zinc-600">
          {message}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onPasteManually}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Paste job description manually
          </button>
          <button
            type="button"
            onClick={onTryAnotherLink}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Try another link
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
