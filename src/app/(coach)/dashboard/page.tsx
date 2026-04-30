"use client";

import { Fragment, useEffect, useState } from "react";
import { FitBadge } from "@/components/ui/fit-badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  analyses,
  currentResume,
  getStoredJobStatuses,
  jobs,
  saveJobStatuses,
} from "@/mock-data/career-coach";
import type { JobAnalysis, JobPosting, JobStatus } from "@/types/coach";

const STAGES: JobStatus[] = [
  "Analyzed",
  "Applied",
  "For Interview",
];

const STAGE_SELECT_STYLE: Record<JobStatus, string> = {
  Analyzed: "border-zinc-200 bg-zinc-50 text-zinc-600",
  Applied: "border-blue-200 bg-blue-50 text-blue-700",
  "For Interview": "border-violet-200 bg-violet-50 text-violet-700",
};

const STAGE_DOT: Record<JobStatus, string> = {
  Analyzed: "bg-zinc-400",
  Applied: "bg-blue-500",
  "For Interview": "bg-violet-500",
};

const STAGE_BAR_ACTIVE: Record<JobStatus, string> = {
  Analyzed: "border-zinc-300 bg-zinc-50 text-zinc-700",
  Applied: "border-blue-200 bg-blue-50 text-blue-700",
  "For Interview": "border-violet-200 bg-violet-50 text-violet-700",
};

type GroupedItem = { job: JobPosting; analysis: JobAnalysis };

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, JobStatus>>({});

  useEffect(() => {
    setStatuses(getStoredJobStatuses());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    saveJobStatuses(statuses);
  }, [mounted, statuses]);

  function updateStatus(jobId: string, status: JobStatus) {
    setStatuses((prev) => ({ ...prev, [jobId]: status }));
  }

  const grouped: Record<JobStatus, GroupedItem[]> = {
    Analyzed: [],
    Applied: [],
    "For Interview": [],
  };

  for (const analysis of analyses) {
    const job = jobs.find((j) => j.id === analysis.jobId);
    if (!job) continue;
    const status = statuses[job.id] ?? "Analyzed";
    grouped[status].push({ job, analysis });
  }

  const strongFits = analyses.filter((a) => a.fit === "Strong Fit").length;
  const inInterview = grouped["For Interview"].length;

  if (!mounted) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Where you stand right now — your resume, your targets, and how you match."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active resume" value={currentResume.fileName} />
        <StatCard label="Jobs tracked" value={`${jobs.length}`} />
        <StatCard label="Strong fits" value={`${strongFits}`} />
        <StatCard label="In interview" value={`${inInterview}`} />
      </div>

      {/* ── Pipeline ── */}
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Pipeline</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Your application stages at a glance
        </p>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-0 overflow-x-auto pb-1">
          {STAGES.map((stage, i) => {
            const count = grouped[stage].length;
            const hasJobs = count > 0;
            return (
              <Fragment key={stage}>
                {i > 0 && (
                  <div className="h-px w-5 shrink-0 bg-zinc-200" />
                )}
                <div
                  className={`flex shrink-0 flex-col items-center rounded-lg border px-4 py-2.5 ${
                    hasJobs
                      ? STAGE_BAR_ACTIVE[stage]
                      : "border-zinc-100 bg-zinc-50/50 text-zinc-300"
                  }`}
                >
                  <span
                    className={`text-lg font-semibold leading-none ${hasJobs ? "" : "text-zinc-300"}`}
                  >
                    {count}
                  </span>
                  <span
                    className={`mt-1 text-[10px] font-medium leading-none ${hasJobs ? "opacity-70" : "text-zinc-300"}`}
                  >
                    {stage}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>

        {/* Grouped sections */}
        <div className="mt-6 space-y-5">
          {STAGES.map((stage) => {
            const items = grouped[stage];
            return (
              <div key={stage}>
                {/* Section header */}
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${STAGE_DOT[stage]}`}
                  />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {stage}
                  </h3>
                  <span className="text-[11px] font-medium text-zinc-300">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="mt-2 pl-4 text-[12px] text-zinc-300">
                    No roles in this stage
                  </p>
                ) : (
                  <div className="mt-2 space-y-2 pl-4">
                    {items.map(({ job, analysis }) => (
                      <div
                        key={job.id}
                        className="flex flex-col gap-2 rounded-lg border border-zinc-100 bg-zinc-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900">
                            {job.title}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {job.company} · {job.location}
                            {job.salaryRange && (
                              <span className="text-zinc-400">
                                {" "}
                                · {job.salaryRange}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <FitBadge
                            fit={analysis.fit}
                            score={analysis.score}
                          />
                          <div className="relative">
                            <select
                              value={stage}
                              onChange={(e) =>
                                updateStatus(
                                  job.id,
                                  e.target.value as JobStatus,
                                )
                              }
                              className={`cursor-pointer appearance-none rounded-full border py-1 pl-2.5 pr-7 text-[11px] font-semibold leading-tight focus:outline-none ${STAGE_SELECT_STYLE[stage]}`}
                            >
                              {STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-40">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="m6 9 6 6 6-6" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Next steps ── */}
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Next steps</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-zinc-600">
          <li>
            Add missing metrics to your top resume bullets so Chris can improve
            them.
          </li>
          <li>Review your saved jobs and run fit analysis for priority roles.</li>
          <li>
            Ask Chris to help prep interview questions for your best match.
          </li>
        </ul>
      </section>

      <p className="pt-1 text-xs text-zinc-400">
        Your data is stored locally in your browser and isn&#39;t shared with other users.
      </p>
    </>
  );
}
