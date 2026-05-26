"use client";

import { useEffect, useState } from "react";
import { ALPHA_SESSION_CHANGED_EVENT } from "@/lib/alpha-session-store";
import {
  createResume,
  duplicateResume,
  getActiveResumeId,
  getAllResumeRecords,
  renameResume,
  RESUME_STORAGE_CHANGED_EVENT,
  setActiveResume,
  type StoredResumeRecord,
} from "@/lib/resume-store";

type ResumeVersionBarProps = {
  onSwitch?: () => void;
};

export function ResumeVersionBar({ onSwitch }: ResumeVersionBarProps) {
  const [resumes, setResumes] = useState<StoredResumeRecord[]>(() =>
    typeof window === "undefined" ? [] : getAllResumeRecords(),
  );
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getActiveResumeId(),
  );

  function refresh(): void {
    setResumes(getAllResumeRecords());
    setActiveId(getActiveResumeId());
  }

  useEffect(() => {
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

  function handleSwitch(resumeId: string): void {
    if (resumeId === activeId) return;
    setActiveResume(resumeId);
    refresh();
    onSwitch?.();
  }

  function handleNew(): void {
    const name = window.prompt("Name for new resume", `Resume ${resumes.length + 1}`);
    if (name === null) return;
    createResume(name || undefined);
    refresh();
    onSwitch?.();
  }

  function handleDuplicate(): void {
    if (!activeId) {
      handleNew();
      return;
    }
    duplicateResume(activeId);
    refresh();
    onSwitch?.();
  }

  function handleRename(): void {
    if (!activeId) return;
    const current = resumes.find((resume) => resume.id === activeId);
    const nextName = window.prompt("Rename resume", current?.name ?? "");
    if (nextName === null || !nextName.trim()) return;
    renameResume(activeId, nextName);
    refresh();
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <label htmlFor="resume-version-select" className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Resume version
        </label>
        <select
          id="resume-version-select"
          value={activeId ?? ""}
          onChange={(event) => handleSwitch(event.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800"
        >
          {resumes.length === 0 ? (
            <option value="">No resumes yet</option>
          ) : (
            resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
                {resume.savedAt ? " · saved" : ""}
              </option>
            ))
          )}
        </select>
        <p className="mt-1 text-[11px] text-zinc-500">
          {resumes.length} saved version{resumes.length === 1 ? "" : "s"} — switch to tailor fit per role.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handleNew}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          New
        </button>
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={resumes.length === 0 && !activeId}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={handleRename}
          disabled={!activeId}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Rename
        </button>
      </div>
    </div>
  );
}
