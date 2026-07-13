"use client";

import { useState } from "react";

type RenameResumeDialogProps = {
  open: boolean;
  currentName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

function RenameResumeDialogBody({
  currentName,
  onConfirm,
  onCancel,
}: Omit<RenameResumeDialogProps, "open">) {
  const [name, setName] = useState(currentName);
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentName.trim();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-resume-title"
    >
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h2 id="rename-resume-title" className="text-sm font-semibold text-zinc-900">
          Rename resume version
        </h2>
        <label htmlFor="rename-resume-input" className="mt-3 block text-xs font-medium text-zinc-700">
          Version name
        </label>
        <input
          id="rename-resume-input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSave) {
              onConfirm(trimmed);
            }
          }}
          className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
          autoFocus
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onConfirm(trimmed)}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save name
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

export function RenameResumeDialog({
  open,
  currentName,
  onConfirm,
  onCancel,
}: RenameResumeDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <RenameResumeDialogBody
      key={currentName}
      currentName={currentName}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
