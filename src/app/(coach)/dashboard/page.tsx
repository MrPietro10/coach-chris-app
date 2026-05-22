"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { JobApplicationTracking } from "@/components/jobs/job-application-tracking";
import { FitBadge } from "@/components/ui/fit-badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import {
  getActiveResumeLabel,
  getAllStoredJobs,
  getAnalyzedJobsState,
  getComputedJobAnalysesState,
  setSelectedJobId,
} from "@/lib/job-session-store";
import {
  JOB_STATUS_BAR_ACTIVE,
  JOB_STATUS_DOT,
  JOB_STATUS_LABELS,
  PIPELINE_STAGES,
} from "@/lib/job-pipeline";
import {
  getStoredJobStatuses,
  JOB_PIPELINE_UPDATED_EVENT,
} from "@/lib/job-pipeline-store";
import { analyses, jobs } from "@/mock-data/career-coach";
import type { JobAnalysis, JobPosting, JobStatus } from "@/types/coach";

type GroupedItem = { job: JobPosting; analysis: JobAnalysis };

function readDashboardState() {
  const trackedJobs = getAllStoredJobs(jobs);
  const computedAnalyses = getComputedJobAnalysesState();
  const analyzedJobsState = getAnalyzedJobsState();
  const analyzedItems: GroupedItem[] = [];
  for (const job of trackedJobs) {
    const analysis = getReadyAnalysisForJob(job.id, computedAnalyses, analyses);
    if (!analysis && !analyzedJobsState[job.id]) continue;
    if (!analysis) continue;
    analyzedItems.push({ job, analysis });
  }

  return {
    trackedJobs,
    analyzedItems,
    activeResumeLabel: getActiveResumeLabel(),
    statuses: getStoredJobStatuses(),
  };
}

export default function DashboardPage() {
  const isClient = useIsClient();
  const [dashboardState, setDashboardState] = useState(() =>
    typeof window === "undefined"
      ? {
          trackedJobs: jobs,
          analyzedItems: [] as GroupedItem[],
          activeResumeLabel: "Not added",
          statuses: {} as Record<string, JobStatus>,
        }
      : readDashboardState(),
  );

  useEffect(() => {
    if (!isClient) return;

    const refresh = () => setDashboardState(readDashboardState());

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("career-coach:analysis-updated", refresh);
    window.addEventListener(JOB_PIPELINE_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("career-coach:analysis-updated", refresh);
      window.removeEventListener(JOB_PIPELINE_UPDATED_EVENT, refresh);
    };
  }, [isClient]);

  function updateStatus(jobId: string, status: JobStatus) {
    setDashboardState((prev) => ({
      ...prev,
      statuses: { ...prev.statuses, [jobId]: status },
    }));
  }

  const grouped = useMemo(() => {
    const next = Object.fromEntries(
      PIPELINE_STAGES.map((stage) => [stage, [] as GroupedItem[]]),
    ) as Record<JobStatus, GroupedItem[]>;

    for (const item of dashboardState.analyzedItems) {
      const status = dashboardState.statuses[item.job.id] ?? "Analyzed";
      next[status].push(item);
    }

    return next;
  }, [dashboardState.analyzedItems, dashboardState.statuses]);

  const strongFits = dashboardState.analyzedItems.filter(
    (item) => item.analysis.fit === "Strong Fit",
  ).length;
  const offers = grouped.Offer.length;
  const activePipeline = dashboardState.analyzedItems.filter(
    (item) => (dashboardState.statuses[item.job.id] ?? "Analyzed") !== "Archived",
  ).length;

  if (!isClient) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Track application status and notes for each role alongside your fit analysis."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active resume" value={dashboardState.activeResumeLabel} />
        <StatCard label="Jobs in pipeline" value={`${activePipeline}`} />
        <StatCard label="Strong fits" value={`${strongFits}`} />
        <StatCard label="Offers" value={`${offers}`} />
      </div>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Pipeline</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Update status and notes on each role as your search progresses.
        </p>

        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = grouped[stage].length;
            const hasJobs = count > 0;
            return (
              <Fragment key={stage}>
                {i > 0 ? <div className="mx-0.5 h-px w-4 shrink-0 bg-zinc-200" /> : null}
                <div
                  className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 ${
                    hasJobs ? JOB_STATUS_BAR_ACTIVE[stage] : "border-zinc-100 bg-zinc-50/50 text-zinc-300"
                  }`}
                  title={JOB_STATUS_LABELS[stage]}
                >
                  <span className={`text-base font-semibold leading-none ${hasJobs ? "" : "text-zinc-300"}`}>
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

        <div className="mt-6 space-y-6">
          {PIPELINE_STAGES.map((stage) => {
            const items = grouped[stage];
            if (items.length === 0) return null;
            return (
              <div key={stage}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${JOB_STATUS_DOT[stage]}`} />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    {JOB_STATUS_LABELS[stage]}
                  </h3>
                  <span className="text-[11px] font-medium text-zinc-400">{items.length}</span>
                </div>

                <div className="mt-2 space-y-3">
                  {items.map(({ job, analysis }) => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-zinc-900">{job.title}</p>
                            <FitBadge fit={analysis.fit} score={analysis.score} />
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {job.company}
                            {job.location ? ` · ${job.location}` : ""}
                          </p>
                          <Link
                            href="/results"
                            onClick={() => setSelectedJobId(job.id)}
                            className="mt-1 inline-block text-[11px] font-medium text-zinc-600 underline-offset-2 hover:underline"
                          >
                            View fit results
                          </Link>
                        </div>
                      </div>
                      <div className="mt-3">
                        <JobApplicationTracking
                          key={job.id}
                          jobId={job.id}
                          currentStatus={dashboardState.statuses[job.id] ?? "Analyzed"}
                          hasAnalysis
                          variant="card"
                          onStatusChange={(next) => updateStatus(job.id, next)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {dashboardState.analyzedItems.length === 0 ? (
            <p className="text-sm text-zinc-500">Run analysis on saved jobs to populate your pipeline.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Next steps</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-zinc-600">
          <li>Update status when you apply, interview, receive offers, or close out roles.</li>
          <li>Use application notes for recruiter feedback and interview prep.</li>
          <li>Review fit results before prioritizing which roles to pursue.</li>
        </ul>
      </section>

      <p className="pt-1 text-xs text-zinc-400">
        Pipeline data is stored locally in your browser (alpha-scoped) and isn&apos;t shared with other users.
      </p>
    </>
  );
}
