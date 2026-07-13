"use client";

export type TailoredDraftResumeIntent = "export" | "copy";

type ExportTailoredDraftDialogProps = {
  open: boolean;
  intent: TailoredDraftResumeIntent;
  isSaving?: boolean;
  onSaveAndPrimary: () => void;
  onUseSavedVersion: () => void;
  onCancel: () => void;
};

const COPY_BY_INTENT: Record<
  TailoredDraftResumeIntent,
  {
    title: string;
    description: string;
    primary: string;
    primaryBusy: string;
    secondary: string;
  }
> = {
  export: {
    title: "Save before exporting?",
    description: "Save this tailored resume before exporting?",
    primary: "Save and export",
    primaryBusy: "Saving…",
    secondary: "Use current saved version",
  },
  copy: {
    title: "Save before copying?",
    description: "Save this tailored resume before copying?",
    primary: "Save and copy",
    primaryBusy: "Saving…",
    secondary: "Use current saved version",
  },
};

export function ExportTailoredDraftDialog({
  open,
  intent,
  isSaving = false,
  onSaveAndPrimary,
  onUseSavedVersion,
  onCancel,
}: ExportTailoredDraftDialogProps) {
  if (!open) {
    return null;
  }

  const copy = COPY_BY_INTENT[intent];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/50 px-5 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-tailored-draft-title"
      aria-describedby="export-tailored-draft-description"
    >
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 id="export-tailored-draft-title" className="text-lg font-semibold text-zinc-900">
          {copy.title}
        </h2>
        <p id="export-tailored-draft-description" className="mt-2 text-sm text-zinc-600">
          {copy.description}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={isSaving}
            onClick={onSaveAndPrimary}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? copy.primaryBusy : copy.primary}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onUseSavedVersion}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.secondary}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
