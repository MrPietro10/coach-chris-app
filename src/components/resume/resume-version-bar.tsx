"use client";

import { useEffect, useMemo, useState } from "react";
import { ALPHA_SESSION_CHANGED_EVENT } from "@/lib/alpha-session-store";
import { getComputedJobAnalysesState, JOB_WORKSPACE_CHANGED_EVENT } from "@/lib/job-session-store";
import {
  formatResumeDateShort,
  formatResumeVersionOptionLabel,
  getResumeVersionDisplayMeta,
  getTailoredResumeLinkMeta,
} from "@/lib/resume-version-display";
import { ResumeVersionMetadataLines } from "@/components/resume/resume-version-metadata-lines";
import { RemoveTailoredResumeConfirmDialog } from "@/components/resume/remove-tailored-resume-confirm-dialog";
import { RenameResumeDialog } from "@/components/resume/rename-resume-dialog";
import {
  formatLastAnalysisUsageLabel,
  getLastAnalysisUsageForResume,
} from "@/lib/resume-version-analysis-usage";
import {
  createResume,
  duplicateResume,
  getActiveResumeId,
  getAllResumeRecords,
  removeResume,
  renameResume,
  RESUME_STORAGE_CHANGED_EVENT,
  setActiveResume,
  type StoredResumeRecord,
} from "@/lib/resume-store";

type ResumeVersionBarProps = {
  onSwitch?: () => void;
  onRename?: (name: string) => void;
  onRemoveTailored?: (name: string) => void;
};

function CompactResumeMetadata({
  record,
  isActive,
  lastAnalysisUsage,
  onRequestRemoveTailored,
}: {
  record: StoredResumeRecord;
  isActive: boolean;
  lastAnalysisUsage: ReturnType<typeof getLastAnalysisUsageForResume>;
  onRequestRemoveTailored: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const meta = getResumeVersionDisplayMeta(record);
  const tailoredLink = getTailoredResumeLinkMeta(record);
  const updatedShort = formatResumeDateShort(record.updatedAt);
  const hasHiddenDetails = Boolean(meta.uploadedLabel || meta.sourceFileLabel || meta.addedLabel);

  return (
    <div className="mt-2 rounded-md border border-zinc-200/70 bg-white/60 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-zinc-800">{record.name}</p>
        {isActive ? (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
            Active
          </span>
        ) : null}
      </div>
      <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-600">
        {updatedShort ? <li>Last updated: {updatedShort}</li> : null}
        <ResumeVersionMetadataLines record={record} activeResumeId={isActive ? record.id : null} showActiveLabel={false} />
        {lastAnalysisUsage ? (
          <li>Last used for analysis: {formatLastAnalysisUsageLabel(lastAnalysisUsage)}</li>
        ) : null}
      </ul>
      {tailoredLink?.isRemoved ? (
        <button
          type="button"
          onClick={onRequestRemoveTailored}
          className="mt-2 text-[11px] font-medium text-rose-700 underline-offset-2 hover:underline"
        >
          Remove this tailored resume
        </button>
      ) : null}
      {hasHiddenDetails ? (
        <>
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            className="mt-1.5 text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline"
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>
          {showDetails ? (
            <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
              {meta.uploadedLabel ? <li>{meta.uploadedLabel}</li> : null}
              {!meta.uploadedLabel && meta.addedLabel ? <li>{meta.addedLabel}</li> : null}
              {meta.sourceFileLabel ? <li>{meta.sourceFileLabel}</li> : null}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function ResumeVersionBar({ onSwitch, onRename, onRemoveTailored }: ResumeVersionBarProps) {
  const [resumes, setResumes] = useState<StoredResumeRecord[]>(() =>
    typeof window === "undefined" ? [] : getAllResumeRecords(),
  );
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getActiveResumeId(),
  );
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [removeTailoredDialogOpen, setRemoveTailoredDialogOpen] = useState(false);

  function refresh(): void {
    setResumes(getAllResumeRecords());
    setActiveId(getActiveResumeId());
  }

  useEffect(() => {
    const handleExternalSync = () => refresh();
    window.addEventListener(RESUME_STORAGE_CHANGED_EVENT, handleExternalSync);
    window.addEventListener("storage", handleExternalSync);
    window.addEventListener("focus", handleExternalSync);
    window.addEventListener(ALPHA_SESSION_CHANGED_EVENT, handleExternalSync);
    window.addEventListener(JOB_WORKSPACE_CHANGED_EVENT, handleExternalSync);
    window.addEventListener("career-coach:analysis-updated", handleExternalSync);
    return () => {
      window.removeEventListener(RESUME_STORAGE_CHANGED_EVENT, handleExternalSync);
      window.removeEventListener("storage", handleExternalSync);
      window.removeEventListener("focus", handleExternalSync);
      window.removeEventListener(ALPHA_SESSION_CHANGED_EVENT, handleExternalSync);
      window.removeEventListener(JOB_WORKSPACE_CHANGED_EVENT, handleExternalSync);
      window.removeEventListener("career-coach:analysis-updated", handleExternalSync);
    };
  }, []);

  const activeResume = useMemo(
    () => resumes.find((resume) => resume.id === activeId) ?? null,
    [activeId, resumes],
  );

  const activeLastAnalysisUsage = useMemo(() => {
    if (!activeResume) return null;
    return getLastAnalysisUsageForResume(activeResume.id, getComputedJobAnalysesState());
  }, [activeResume]);

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

  function handleRenameConfirm(nextName: string): void {
    if (!activeId) return;
    const saved = renameResume(activeId, nextName);
    if (!saved) return;
    setRenameDialogOpen(false);
    refresh();
    onSwitch?.();
    onRename?.(nextName.trim());
  }

  function handleConfirmRemoveTailored(): void {
    if (!activeResume) return;
    const removedName = activeResume.name;
    const removed = removeResume(activeResume.id);
    setRemoveTailoredDialogOpen(false);
    if (!removed) return;
    refresh();
    onSwitch?.();
    onRemoveTailored?.(removedName);
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/40 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-zinc-800">Resume versions</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Choose which resume Coach Chris should use for analysis.
          </p>
          <label htmlFor="resume-version-select" className="sr-only">
            Active resume version
          </label>
          <select
            id="resume-version-select"
            value={activeId ?? ""}
            onChange={(event) => handleSwitch(event.target.value)}
            className="mt-2 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800"
          >
            {resumes.length === 0 ? (
              <option value="">No resumes yet</option>
            ) : (
              resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {formatResumeVersionOptionLabel(resume)}
                </option>
              ))
            )}
          </select>
          {activeResume ? (
            <CompactResumeMetadata
              record={activeResume}
              isActive={activeResume.id === activeId}
              lastAnalysisUsage={activeLastAnalysisUsage}
              onRequestRemoveTailored={() => setRemoveTailoredDialogOpen(true)}
            />
          ) : null}
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {resumes.length === 0
              ? "Upload or create a resume to get started."
              : resumes.length === 1
                ? "One saved version — duplicate to tailor for another role."
                : `${resumes.length} saved versions — switch to tailor fit per role.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:pt-0.5">
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
            onClick={() => setRenameDialogOpen(true)}
            disabled={!activeId}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Rename
          </button>
        </div>
      </div>

      <RenameResumeDialog
        open={renameDialogOpen}
        currentName={activeResume?.name ?? ""}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameDialogOpen(false)}
      />

      <RemoveTailoredResumeConfirmDialog
        open={removeTailoredDialogOpen}
        resumeName={activeResume?.name ?? "this tailored resume"}
        onConfirm={handleConfirmRemoveTailored}
        onCancel={() => setRemoveTailoredDialogOpen(false)}
      />
    </>
  );
}
