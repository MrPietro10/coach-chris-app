"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobActiveBadge } from "@/components/jobs/job-active-badge";
import { FitBadge } from "@/components/ui/fit-badge";
import { setActiveJob } from "@/lib/active-job";
import { formatJobLastUpdated, type DashboardJobEntry } from "@/lib/dashboard-jobs";
import { JOB_STATUS_LABELS, JOB_STATUS_SELECT_STYLE } from "@/lib/job-pipeline";

type DashboardActiveJobPanelProps = {
  entry: DashboardJobEntry | null;
  isAnalyzing: boolean;
};

export function DashboardActiveJobPanel({ entry, isAnalyzing }: DashboardActiveJobPanelProps) {
  const router = useRouter();

  if (!entry) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-5 py-4">
        <p className="text-sm font-medium text-zinc-800">No active job selected</p>
        <p className="mt-1 text-xs text-zinc-500">
          Pick a role below or add a new job to start analyzing fit.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/analyze"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Add a job
          </Link>
          <Link
            href="/batch"
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-white"
          >
            View saved jobs
          </Link>
        </div>
      </section>
    );
  }

  const { job, analysis, pipelineStatus, hasReadyAnalysis, lastUpdatedAt } = entry;
  const status = pipelineStatus ?? (hasReadyAnalysis ? "Analyzed" : null);
  const statusStyle = status ? JOB_STATUS_SELECT_STYLE[status] : "border-zinc-200 bg-zinc-50 text-zinc-600";

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/50 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              Active job
            </p>
            <JobActiveBadge variant="active" />
            {isAnalyzing ? <JobActiveBadge variant="analyzing" /> : null}
          </div>
          <h2 className="mt-1 truncate text-base font-semibold text-zinc-900">{job.title}</h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {status ? (
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle}`}
              >
                {JOB_STATUS_LABELS[status]}
              </span>
            ) : null}
            {analysis ? <FitBadge fit={analysis.fit} score={analysis.score} /> : null}
            <span className="text-[11px] text-zinc-500">
              Updated {formatJobLastUpdated(lastUpdatedAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveJob(job.id, { analyzeOnOpen: !hasReadyAnalysis });
              router.push("/results");
            }}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            {hasReadyAnalysis ? "Open analysis" : "Analyze fit"}
          </button>
          <Link
            href="/batch"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            All saved jobs
          </Link>
        </div>
      </div>
    </section>
  );
}
