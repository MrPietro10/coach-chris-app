"use client";

import { useRouter } from "next/navigation";
import { JobActiveBadge } from "@/components/jobs/job-active-badge";
import { JobApplicationTracking } from "@/components/jobs/job-application-tracking";
import { FitBadge } from "@/components/ui/fit-badge";
import { setActiveJob } from "@/lib/active-job";
import { formatJobLastUpdated, type DashboardJobEntry } from "@/lib/dashboard-jobs";
import { JOB_STATUS_LABELS, JOB_STATUS_SELECT_STYLE } from "@/lib/job-pipeline";
import type { JobStatus } from "@/types/coach";

type DashboardJobCardProps = {
  entry: DashboardJobEntry;
  isActive: boolean;
  isAnalyzing: boolean;
  isUserAdded: boolean;
  compact?: boolean;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  onRemove: (jobId: string) => void;
};

export function DashboardJobCard({
  entry,
  isActive,
  isAnalyzing,
  isUserAdded,
  compact = false,
  onStatusChange,
  onRemove,
}: DashboardJobCardProps) {
  const router = useRouter();
  const { job, analysis, pipelineStatus, hasReadyAnalysis, lastUpdatedAt } = entry;
  const status = pipelineStatus ?? (hasReadyAnalysis ? "Analyzed" : null);
  const statusStyle = status ? JOB_STATUS_SELECT_STYLE[status] : "border-zinc-200 bg-zinc-50 text-zinc-600";

  function openAnalysis(analyzeIfNeeded: boolean): void {
    setActiveJob(job.id, { analyzeOnOpen: analyzeIfNeeded && !hasReadyAnalysis });
    router.push("/results");
  }

  function continueEditing(): void {
    setActiveJob(job.id);
    router.push(isUserAdded ? `/batch?edit=${encodeURIComponent(job.id)}` : "/batch");
  }

  function handleRemove(): void {
    onRemove(job.id);
  }

  return (
    <article
      className={`rounded-lg border px-4 py-3 transition-colors ${
        isActive
          ? "border-sky-200 bg-sky-50/40"
          : "border-zinc-200/80 bg-white hover:border-zinc-300"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-zinc-900">{job.title}</h3>
            {isActive ? <JobActiveBadge variant="active" /> : null}
            {isAnalyzing ? <JobActiveBadge variant="analyzing" /> : null}
            {analysis ? <FitBadge fit={analysis.fit} score={analysis.score} /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            {status ? (
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${statusStyle}`}
              >
                {JOB_STATUS_LABELS[status]}
              </span>
            ) : (
              <span className="text-zinc-400">Not analyzed</span>
            )}
            <span>Updated {formatJobLastUpdated(lastUpdatedAt)}</span>
          </div>
          {!compact && entry.notesPreview ? (
            <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{entry.notesPreview}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => openAnalysis(false)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
            >
              {hasReadyAnalysis ? "Open analysis" : "Analyze fit"}
            </button>
            {isUserAdded ? (
              <button
                type="button"
                onClick={continueEditing}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Continue editing
              </button>
            ) : null}
            {!isActive ? (
              <button
                type="button"
                onClick={() => setActiveJob(job.id)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Set active
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleRemove}
              aria-label={`Remove ${job.title}`}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {!compact && status ? (
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <JobApplicationTracking
            jobId={job.id}
            currentStatus={status}
            hasAnalysis={hasReadyAnalysis}
            variant="compact"
            onStatusChange={(next) => onStatusChange(job.id, next)}
          />
        </div>
      ) : null}
    </article>
  );
}
