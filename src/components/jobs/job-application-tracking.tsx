"use client";

import { useEffect, useState } from "react";
import {
  getJobApplicationNote,
  getStoredJobStatusTimestamps,
  JOB_PIPELINE_UPDATED_EVENT,
  setJobApplicationNote,
  setStoredJobStatus,
} from "@/lib/job-pipeline-store";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_SELECT_STYLE,
  PIPELINE_STAGES,
  resolveJobStatus,
} from "@/lib/job-pipeline";
import type { JobStatus } from "@/types/coach";

type JobApplicationTrackingProps = {
  jobId: string;
  currentStatus: JobStatus | null;
  hasAnalysis?: boolean;
  variant?: "compact" | "card";
  onStatusChange?: (status: JobStatus) => void;
  onNotesChange?: (note: string) => void;
};

export function JobApplicationTracking({
  jobId,
  currentStatus,
  hasAnalysis = false,
  variant = "compact",
  onStatusChange,
  onNotesChange,
}: JobApplicationTrackingProps) {
  const status =
    currentStatus ?? resolveJobStatus(jobId, {}, { hasAnalysis }) ?? "Analyzed";
  const [notes, setNotes] = useState(() => getJobApplicationNote(jobId));
  const [showNotes, setShowNotes] = useState(() => getJobApplicationNote(jobId).length > 0);
  const statusUpdatedAt = getStoredJobStatusTimestamps()[jobId];

  useEffect(() => {
    const syncNotes = () => {
      const nextNote = getJobApplicationNote(jobId);
      setNotes(nextNote);
      if (nextNote.length > 0) setShowNotes(true);
    };
    window.addEventListener(JOB_PIPELINE_UPDATED_EVENT, syncNotes);
    return () => window.removeEventListener(JOB_PIPELINE_UPDATED_EVENT, syncNotes);
  }, [jobId]);

  function handleStatusChange(next: JobStatus): void {
    setStoredJobStatus(jobId, next);
    onStatusChange?.(next);
  }

  function handleNotesBlur(): void {
    setJobApplicationNote(jobId, notes);
    onNotesChange?.(notes);
  }

  const statusStyle = JOB_STATUS_SELECT_STYLE[status];

  if (variant === "card") {
    return (
      <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Application status
            </p>
            <p className={`mt-1 text-sm font-semibold ${statusStyle.split(" ").find((c) => c.startsWith("text-")) ?? "text-zinc-800"}`}>
              {JOB_STATUS_LABELS[status]}
            </p>
            {statusUpdatedAt ? (
              <p className="mt-0.5 text-[10px] text-zinc-400">
                Updated {new Date(statusUpdatedAt).toLocaleDateString()}
              </p>
            ) : null}
          </div>
          <div className="relative min-w-[9rem]">
            <label htmlFor={`job-status-${jobId}`} className="sr-only">
              Update application status
            </label>
            <select
              id={`job-status-${jobId}`}
              value={status}
              onChange={(event) => handleStatusChange(event.target.value as JobStatus)}
              className={`w-full cursor-pointer appearance-none rounded-lg border py-1.5 pl-2.5 pr-8 text-xs font-semibold focus:outline-none ${statusStyle}`}
            >
              {PIPELINE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {JOB_STATUS_LABELS[stage]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Application notes
            </p>
            <button
              type="button"
              onClick={() => setShowNotes((open) => !open)}
              className="text-[11px] font-medium text-zinc-600 underline-offset-2 hover:underline"
            >
              {showNotes ? "Hide" : "Add notes"}
            </button>
          </div>
          {showNotes ? (
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Interview reflections, recruiter feedback, follow-up reminders…"
              className="mt-2 min-h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="relative">
        <label htmlFor={`job-status-compact-${jobId}`} className="sr-only">
          Application status
        </label>
        <select
          id={`job-status-compact-${jobId}`}
          value={status}
          onChange={(event) => handleStatusChange(event.target.value as JobStatus)}
          className={`cursor-pointer appearance-none rounded-full border py-1 pl-2.5 pr-7 text-[11px] font-semibold leading-tight focus:outline-none ${statusStyle}`}
        >
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {JOB_STATUS_LABELS[stage]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => setShowNotes((open) => !open)}
        className="text-[10px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline"
      >
        {showNotes || notes.length > 0 ? "Notes" : "Add notes"}
      </button>
      {showNotes ? (
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Notes…"
          className="w-full min-w-[12rem] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 sm:max-w-xs"
        />
      ) : null}
    </div>
  );
}
