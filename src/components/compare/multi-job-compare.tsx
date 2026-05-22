"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildAnalysisResumeContextFromStored, hasAnalysisResumeContext } from "@/lib/analysis-resume-context";
import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import {
  calculateResumeCompleteness,
  runJobAnalysisForPosting,
} from "@/lib/client-run-job-analysis";
import {
  buildComparisonRowsFromState,
  groupRowsByRanking,
  JOB_RANKING_LABELS,
  MAX_MULTI_JOB_COMPARE,
  MIN_MULTI_JOB_COMPARE,
  type JobComparisonRow,
  type JobRankingBucket,
} from "@/lib/multi-job-comparison";
import {
  getAllStoredJobs,
  getComputedJobAnalysesState,
  getStoredResumeInput,
  isResumeReadyForAnalysis,
  setComputedJobAnalysis,
  setJobAnalyzed,
  setSelectedJobId,
  type ComputedJobAnalysesState,
} from "@/lib/job-session-store";
import { logEvent } from "@/lib/alpha-usage-logger";
import { FitBadge } from "@/components/ui/fit-badge";
import { PageHeader } from "@/components/ui/page-header";
import { analyses, jobs, optimizeByJob, setStoredJobStatus, getStoredJobStatuses } from "@/mock-data/career-coach";
import { formatEvidenceStrengthLabel, fitColor } from "@/utils/fit";
import type { JobPosting } from "@/types/coach";

function notifyAnalysisUpdated(): void {
  window.dispatchEvent(new Event("career-coach:analysis-updated"));
}

const RANKING_SECTION_STYLES: Record<JobRankingBucket, string> = {
  best_immediate_fit: "border-emerald-200 bg-emerald-50/60",
  needs_resume_tailoring: "border-amber-200 bg-amber-50/60",
  stretch_opportunity: "border-sky-200 bg-sky-50/60",
};

const RANKING_BADGE_STYLES: Record<JobRankingBucket, string> = {
  best_immediate_fit: "border-emerald-200 bg-emerald-50 text-emerald-800",
  needs_resume_tailoring: "border-amber-200 bg-amber-50 text-amber-800",
  stretch_opportunity: "border-sky-200 bg-sky-50 text-sky-800",
};

export function MultiJobCompare() {
  const router = useRouter();
  const [allJobs, setAllJobs] = useState<JobPosting[]>(() =>
    typeof window === "undefined" ? jobs : getAllStoredJobs(jobs),
  );
  const [computedAnalyses, setComputedAnalyses] = useState<ComputedJobAnalysesState>(() =>
    typeof window === "undefined" ? {} : getComputedJobAnalysesState(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [failedByJobId, setFailedByJobId] = useState<Record<string, string>>({});
  const [runComplete, setRunComplete] = useState(false);

  const resumeInput = getStoredResumeInput();
  const resumeContext = buildAnalysisResumeContextFromStored(resumeInput);
  const resumeReady = isResumeReadyForAnalysis() && hasAnalysisResumeContext(resumeContext);
  const resumeCompleteness = calculateResumeCompleteness(resumeInput);

  const refresh = useCallback(() => {
    setAllJobs(getAllStoredJobs(jobs));
    setComputedAnalyses(getComputedJobAnalysesState());
  }, []);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener("storage", onUpdate);
    window.addEventListener("focus", onUpdate);
    window.addEventListener("career-coach:analysis-updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("focus", onUpdate);
      window.removeEventListener("career-coach:analysis-updated", onUpdate);
    };
  }, [refresh]);

  const selectedJobs = useMemo(
    () => allJobs.filter((job) => selectedIds.has(job.id)),
    [allJobs, selectedIds],
  );

  const comparisonRows = useMemo(
    () =>
      buildComparisonRowsFromState({
        jobs: selectedJobs.length > 0 ? selectedJobs : [],
        computedAnalyses,
        staticAnalyses: analyses,
        resumeCompleteness,
        failedJobIds: failedByJobId,
      }),
    [selectedJobs, computedAnalyses, resumeCompleteness, failedByJobId],
  );

  const rankingGroups = useMemo(() => groupRowsByRanking(comparisonRows), [comparisonRows]);

  const canShowComparison =
    selectedJobs.length >= MIN_MULTI_JOB_COMPARE &&
    (runComplete ||
      comparisonRows.some(
        (row) => row.status === "ready" || row.status === "insufficient_evidence",
      ));

  function toggleJob(jobId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else if (next.size < MAX_MULTI_JOB_COMPARE) {
        next.add(jobId);
      }
      return next;
    });
  }

  async function runMultiJobAnalysis(): Promise<void> {
    if (!resumeReady || selectedJobs.length < MIN_MULTI_JOB_COMPARE || isRunning) {
      return;
    }

    setIsRunning(true);
    setRunComplete(false);
    setFailedByJobId({});
    logEvent("multi_job_compare_start", { count: selectedJobs.length });

    let completed = 0;
    const nextComputed = { ...computedAnalyses };
    const failures: Record<string, string> = {};

    for (const job of selectedJobs) {
      completed += 1;
      setProgressLabel(`Analyzing ${completed} of ${selectedJobs.length}: ${job.company}`);

      const storedComputed = nextComputed[job.id];
      const existingAnalysis = getReadyAnalysisForJob(job.id, nextComputed, analyses);

      const result = await runJobAnalysisForPosting({
        job,
        resumeContext,
        resumeCompleteness,
        storedComputed,
        existingReadyAnalysis: existingAnalysis,
        optimizeData: optimizeByJob[job.id],
      });

      if (!result.ok) {
        failures[job.id] = result.message;
        continue;
      }

      nextComputed[job.id] = result.analysis;
      setJobAnalyzed(job.id, true);
      const currentStatus = getStoredJobStatuses()[job.id];
      if (!currentStatus || currentStatus === "Analyzed") {
        setStoredJobStatus(job.id, "Analyzed");
      }
      setComputedJobAnalysis(result.analysis);
    }

    setComputedAnalyses(nextComputed);
    setFailedByJobId(failures);
    setIsRunning(false);
    setProgressLabel(null);
    setRunComplete(true);
    notifyAnalysisUpdated();
    logEvent("multi_job_compare_complete", {
      count: selectedJobs.length,
      failedCount: Object.keys(failures).length,
    });
  }

  function openJobDetails(jobId: string): void {
    setSelectedJobId(jobId);
    router.push("/results");
  }

  return (
    <>
      <PageHeader
        title="Compare jobs"
        subtitle="Select multiple saved jobs to analyze against the same resume and compare fit side by side."
      />

      {!resumeReady ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Resume required</p>
          <p className="mt-1 text-xs">
            Save your resume for analysis first, then return here to compare jobs.
          </p>
          <Link href="/resume" className="mt-2 inline-block text-xs font-medium underline">
            Go to resume
          </Link>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Select jobs to compare</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Choose {MIN_MULTI_JOB_COMPARE}–{MAX_MULTI_JOB_COMPARE} jobs from your library.{" "}
          <Link href="/batch" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
            Import or add jobs
          </Link>
        </p>

        {allJobs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No saved jobs yet.</p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {allJobs.map((job) => {
              const hasAnalysis = Boolean(
                getReadyAnalysisForJob(job.id, computedAnalyses, analyses),
              );
              const checked = selectedIds.has(job.id);
              const atCap = selectedIds.size >= MAX_MULTI_JOB_COMPARE && !checked;
              return (
                <li
                  key={job.id}
                  className="flex items-start gap-3 rounded-lg border border-zinc-100 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isRunning || atCap}
                    onChange={() => toggleJob(job.id)}
                    className="mt-1"
                    aria-label={`Select ${job.title} at ${job.company}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{job.title}</p>
                    <p className="text-xs text-zinc-500">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  {hasAnalysis ? (
                    <span className="shrink-0 text-[10px] font-medium uppercase text-emerald-700">
                      Analyzed
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-medium uppercase text-zinc-400">
                      Not yet
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={
              !resumeReady ||
              isRunning ||
              selectedIds.size < MIN_MULTI_JOB_COMPARE
            }
            onClick={() => void runMultiJobAnalysis()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning
              ? "Analyzing…"
              : `Analyze ${selectedIds.size} selected job${selectedIds.size === 1 ? "" : "s"}`}
          </button>
          <Link
            href="/analyze"
            className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
          >
            Add one job manually
          </Link>
        </div>

        {progressLabel ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-sky-800">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {progressLabel}
          </p>
        ) : null}
      </section>

      {canShowComparison ? (
        <section className="mt-5 space-y-5">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
            <h2 className="text-sm font-medium text-zinc-900">Comparison</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Same resume, multiple roles — fit, evidence strength, and priority gaps.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Fit</th>
                    <th className="px-3 py-2 font-medium">Evidence strength</th>
                    <th className="px-3 py-2 font-medium">Top gap</th>
                    <th className="px-3 py-2 font-medium">Top priority next step</th>
                    <th className="px-3 py-2 font-medium">Ranking</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {comparisonRows.map((row) => (
                    <ComparisonTableRow key={row.jobId} row={row} onOpenDetails={openJobDetails} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(Object.keys(JOB_RANKING_LABELS) as JobRankingBucket[]).map((bucket) => (
              <RankingSection
                key={bucket}
                bucket={bucket}
                label={JOB_RANKING_LABELS[bucket]}
                rows={rankingGroups[bucket]}
                onOpenDetails={openJobDetails}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function ComparisonTableRow({
  row,
  onOpenDetails,
}: {
  row: JobComparisonRow;
  onOpenDetails: (jobId: string) => void;
}) {
  return (
    <tr className="text-zinc-800">
      <td className="px-3 py-2">
        <p className="font-medium">{row.title}</p>
        <p className="text-zinc-500">{row.company}</p>
      </td>
      <td className="px-3 py-2">
        {row.fit && row.score !== null ? (
          <FitBadge fit={row.fit} score={row.score} />
        ) : (
          <span className="text-zinc-400">{row.status === "failed" ? "Failed" : "—"}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {row.evidenceStrength ? (
          <span className="text-zinc-700">{formatEvidenceStrengthLabel(row.evidenceStrength)}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="max-w-[10rem] px-3 py-2 text-zinc-600">{row.topGap}</td>
      <td className="max-w-[12rem] px-3 py-2 text-zinc-600">{row.topPriorityNextStep}</td>
      <td className="px-3 py-2">
        {row.ranking ? (
          <span
            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium ${RANKING_BADGE_STYLES[row.ranking]}`}
          >
            {JOB_RANKING_LABELS[row.ranking]}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2">
        {row.status === "ready" || row.status === "insufficient_evidence" ? (
          <button
            type="button"
            onClick={() => onOpenDetails(row.jobId)}
            className="text-[11px] font-medium text-zinc-700 underline-offset-2 hover:underline"
          >
            Details
          </button>
        ) : row.statusMessage ? (
          <span className="text-[10px] text-rose-700">{row.statusMessage.slice(0, 40)}…</span>
        ) : null}
      </td>
    </tr>
  );
}

function RankingSection({
  bucket,
  label,
  rows,
  onOpenDetails,
}: {
  bucket: JobRankingBucket;
  label: string;
  rows: JobComparisonRow[];
  onOpenDetails: (jobId: string) => void;
}) {
  return (
    <section className={`rounded-xl border p-4 ${RANKING_SECTION_STYLES[bucket]}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800">{label}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">No roles in this group yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.jobId} className="rounded-lg border border-white/80 bg-white/70 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{row.title}</p>
                  <p className="text-xs text-zinc-500">{row.company}</p>
                  {row.fit && row.score !== null ? (
                    <span
                      className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${fitColor(row.fit)}`}
                    >
                      {row.fit} · {row.score}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDetails(row.jobId)}
                  className="shrink-0 text-[10px] font-medium text-zinc-700 underline-offset-2 hover:underline"
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
