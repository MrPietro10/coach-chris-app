"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { DashboardActiveJobPanel } from "@/components/jobs/dashboard-active-job-panel";
import { DashboardJobCard } from "@/components/jobs/dashboard-job-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ACTIVE_JOB_CHANGED_EVENT, getActiveJobSnapshot } from "@/lib/active-job";
import {
  buildDashboardJobEntries,
  getRecentlyAnalyzedEntries,
  sortByLastUpdated,
} from "@/lib/dashboard-jobs";
import {
  deleteUserJob,
  getActiveResumeLabel,
  getAllStoredJobs,
  getComputedJobAnalysesState,
  JOB_WORKSPACE_CHANGED_EVENT,
} from "@/lib/job-session-store";
import {
  JOB_STATUS_BAR_ACTIVE,
  JOB_STATUS_LABELS,
  PIPELINE_STAGES,
} from "@/lib/job-pipeline";
import {
  getStoredJobStatuses,
  JOB_PIPELINE_UPDATED_EVENT,
} from "@/lib/job-pipeline-store";
import { analyses, jobs } from "@/mock-data/career-coach";
import type { JobStatus } from "@/types/coach";
import { useIsClient } from "@/hooks/use-is-client";

function readDashboardState() {
  const trackedJobs = getAllStoredJobs(jobs);
  const computedAnalyses = getComputedJobAnalysesState();
  const statuses = getStoredJobStatuses();
  const activeSnapshot = getActiveJobSnapshot(jobs);
  const entries = buildDashboardJobEntries({
    trackedJobs,
    computedAnalyses,
    staticAnalyses: analyses,
    statuses,
  });

  return {
    entries,
    activeResumeLabel: getActiveResumeLabel(),
    statuses,
    activeJobId: activeSnapshot.activeJobId,
    analyzingJobId: activeSnapshot.analyzingJobId,
    savedJobCount: trackedJobs.length,
    analyzedCount: entries.filter((entry) => entry.hasReadyAnalysis).length,
  };
}

export default function DashboardPage() {
  const isClient = useIsClient();
  const baseJobIds = useMemo(() => new Set(jobs.map((job) => job.id)), []);
  const [state, setState] = useState(() =>
    typeof window === "undefined"
      ? {
          entries: [],
          activeResumeLabel: "Not added",
          statuses: {} as Record<string, JobStatus>,
          activeJobId: null as string | null,
          analyzingJobId: null as string | null,
          savedJobCount: 0,
          analyzedCount: 0,
        }
      : readDashboardState(),
  );

  useEffect(() => {
    if (!isClient) return;
    const refresh = () => setState(readDashboardState());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("career-coach:analysis-updated", refresh);
    window.addEventListener(JOB_PIPELINE_UPDATED_EVENT, refresh);
    window.addEventListener(ACTIVE_JOB_CHANGED_EVENT, refresh);
    window.addEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("career-coach:analysis-updated", refresh);
      window.removeEventListener(JOB_PIPELINE_UPDATED_EVENT, refresh);
      window.removeEventListener(ACTIVE_JOB_CHANGED_EVENT, refresh);
      window.removeEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
    };
  }, [isClient]);

  const sortedEntries = useMemo(() => sortByLastUpdated(state.entries), [state.entries]);
  const activeEntry = useMemo(
    () => state.entries.find((entry) => entry.job.id === state.activeJobId) ?? null,
    [state.entries, state.activeJobId],
  );
  const recentlyAnalyzed = useMemo(
    () => getRecentlyAnalyzedEntries(state.entries),
    [state.entries],
  );
  const pipelineCounts = useMemo(() => {
    const counts = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<
      JobStatus,
      number
    >;
    for (const entry of state.entries) {
      const status = state.statuses[entry.job.id] ?? entry.pipelineStatus;
      if (status && counts[status] !== undefined) counts[status] += 1;
    }
    return counts;
  }, [state.entries, state.statuses]);

  const activePipeline = state.entries.filter((entry) => {
    const status = state.statuses[entry.job.id] ?? entry.pipelineStatus ?? "Analyzed";
    return status !== "Archived";
  }).length;

  function updateStatus(jobId: string, status: JobStatus) {
    setState((prev) => ({
      ...prev,
      statuses: { ...prev.statuses, [jobId]: status },
    }));
  }

  function handleRemove(jobId: string) {
    deleteUserJob(jobId);
    setState(readDashboardState());
  }

  if (!isClient) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your job workspace — track roles, switch context, and jump back into analysis."
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <Link href="/analyze" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
          Add job
        </Link>
        <span aria-hidden>·</span>
        <Link href="/batch" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
          Saved jobs
        </Link>
        <span aria-hidden>·</span>
        <Link href="/results" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
          Fit results
        </Link>
      </div>

      <DashboardActiveJobPanel
        entry={activeEntry}
        isAnalyzing={Boolean(
          state.activeJobId && state.analyzingJobId && state.activeJobId === state.analyzingJobId,
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saved jobs" value={`${state.savedJobCount}`} />
        <StatCard label="Analyzed" value={`${state.analyzedCount}`} />
        <StatCard label="In pipeline" value={`${activePipeline}`} />
        <StatCard label="Active resume" value={state.activeResumeLabel} />
      </div>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-900">Pipeline overview</h2>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = pipelineCounts[stage];
            const hasJobs = count > 0;
            return (
              <Fragment key={stage}>
                {i > 0 ? <div className="mx-0.5 h-px w-4 shrink-0 bg-zinc-200" /> : null}
                <div
                  className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 ${
                    hasJobs
                      ? JOB_STATUS_BAR_ACTIVE[stage]
                      : "border-zinc-100 bg-zinc-50/50 text-zinc-300"
                  }`}
                  title={JOB_STATUS_LABELS[stage]}
                >
                  <span
                    className={`text-base font-semibold leading-none ${hasJobs ? "" : "text-zinc-300"}`}
                  >
                    {count}
                  </span>
                  <span className="mt-1 max-w-[4.5rem] truncate text-[9px] font-medium leading-tight">
                    {JOB_STATUS_LABELS[stage]}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </section>

      {recentlyAnalyzed.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-900">Recently analyzed</h2>
            <p className="text-xs text-zinc-500">Latest fit runs across your saved roles</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {recentlyAnalyzed.map((entry) => (
              <DashboardJobCard
                key={entry.job.id}
                entry={entry}
                isActive={state.activeJobId === entry.job.id}
                isAnalyzing={state.analyzingJobId === entry.job.id}
                isUserAdded={!baseJobIds.has(entry.job.id)}
                compact
                onStatusChange={updateStatus}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-900">All saved jobs</h2>
          <span className="text-xs text-zinc-500">{sortedEntries.length} roles</span>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="rounded-xl border border-zinc-200/80 bg-white px-5 py-6 text-center">
            <p className="text-sm text-zinc-600">No saved jobs yet.</p>
            <Link
              href="/analyze"
              className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Add your first job
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedEntries.map((entry) => (
              <DashboardJobCard
                key={entry.job.id}
                entry={entry}
                isActive={state.activeJobId === entry.job.id}
                isAnalyzing={state.analyzingJobId === entry.job.id}
                isUserAdded={!baseJobIds.has(entry.job.id)}
                onStatusChange={updateStatus}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-zinc-400">
        Job data is stored locally in your browser (alpha-scoped). Switch active jobs anytime — pipeline
        notes and analysis stay tied to each role.
      </p>
    </>
  );
}
