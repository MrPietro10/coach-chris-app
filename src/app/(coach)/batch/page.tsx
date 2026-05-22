 "use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { JobSpreadsheetImport } from "@/components/batch/job-spreadsheet-import";
import { JobApplicationTracking } from "@/components/jobs/job-application-tracking";
import { FitBadge } from "@/components/ui/fit-badge";
import { PageHeader } from "@/components/ui/page-header";
import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import {
  updateUserJob,
  getComputedJobAnalysesState,
  deleteUserJob,
  getAllStoredJobs,
  markPendingAnalysisJobId,
  setSelectedJobId,
  type ComputedJobAnalysesState,
} from "@/lib/job-session-store";
import { JOB_PIPELINE_UPDATED_EVENT } from "@/lib/job-pipeline-store";
import {
  analyses,
  getStoredJobStatuses,
  jobs,
} from "@/mock-data/career-coach";
import type { JobPosting, JobStatus, JobStatusMap } from "@/types/coach";

function notifySessionDataChanged(): void {
  window.dispatchEvent(new Event("career-coach:analysis-updated"));
}

function readBatchPageState() {
  return {
    allJobs: getAllStoredJobs(jobs),
    computedAnalysesState: getComputedJobAnalysesState(),
    jobStatuses: getStoredJobStatuses(),
  };
}

export default function BatchPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const [allJobs, setAllJobs] = useState<JobPosting[]>(() =>
    typeof window === "undefined" ? jobs : readBatchPageState().allJobs,
  );
  const [computedAnalysesState, setComputedAnalysesState] = useState<ComputedJobAnalysesState>(() =>
    typeof window === "undefined" ? {} : readBatchPageState().computedAnalysesState,
  );
  const [jobStatuses, setJobStatuses] = useState<JobStatusMap>(() =>
    typeof window === "undefined" ? {} : readBatchPageState().jobStatuses,
  );
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [navigatingJobId, setNavigatingJobId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const nextState = readBatchPageState();
      setAllJobs(nextState.allJobs);
      setComputedAnalysesState(nextState.computedAnalysesState);
      setJobStatuses(nextState.jobStatuses);
    };
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
  }, []);

  const baseJobIds = useMemo(() => new Set(jobs.map((job) => job.id)), []);

  function refreshData() {
    setAllJobs(getAllStoredJobs(jobs));
    setComputedAnalysesState(getComputedJobAnalysesState());
    setJobStatuses(getStoredJobStatuses());
  }

  function openEditor(job: JobPosting) {
    setEditingJobId(job.id);
    setEditTitle(job.title);
    setEditCompany(job.company);
    setEditLocation(job.location);
    setEditDescription(job.description);
  }

  if (!isClient) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Saved jobs"
        subtitle="Jobs you are comparing against your resume. Import a spreadsheet or add one job at a time."
      />
      <JobSpreadsheetImport
        onImported={() => {
          refreshData();
          notifySessionDataChanged();
        }}
      />
      <section className="mt-5 rounded-xl border border-zinc-200/80 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Saved jobs</h2>
        {allJobs.length === 0 ? (
          <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-4">
            <p className="text-sm text-zinc-600">Add a job description to compare against your resume.</p>
            <p className="mt-1 text-xs text-zinc-500">
              After you paste a role in Add job, it appears here so you can reopen fit results anytime.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/analyze")}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Add your first job
              </button>
              <button
                type="button"
                onClick={() => router.push("/compare")}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Compare jobs
              </button>
              <button
                type="button"
                onClick={() => router.push("/resume")}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Go to resume
              </button>
            </div>
          </div>
        ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {allJobs.map((job) => {
            const computed = computedAnalysesState[job.id];
            const analysis = getReadyAnalysisForJob(job.id, computedAnalysesState, analyses);
            const hasAnalysis = Boolean(analysis);
            const isUserAdded = !baseJobIds.has(job.id);
            const status: JobStatus | null = jobStatuses[job.id] ?? (hasAnalysis ? "Analyzed" : null);
            return (
              <li key={job.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{job.title}</p>
                    <p className="text-xs text-zinc-500">{job.company} · {job.location || "No location"}</p>
                    {computed?.analysisState === "insufficient_evidence" && (
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                        <span>Insufficient evidence for fit score.</span>
                        <button
                          type="button"
                          disabled={navigatingJobId !== null}
                          onClick={() => {
                            if (navigatingJobId) return;
                            setNavigatingJobId(job.id);
                            setSelectedJobId(job.id);
                            markPendingAnalysisJobId(job.id);
                            router.push("/results");
                          }}
                          className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Complete analysis
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    {hasAnalysis || status ? (
                      <JobApplicationTracking
                        key={job.id}
                        jobId={job.id}
                        currentStatus={status}
                        hasAnalysis={hasAnalysis}
                        variant="compact"
                        onStatusChange={() => refreshData()}
                      />
                    ) : null}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                    {analysis && <FitBadge fit={analysis.fit} score={analysis.score} />}
                    <button
                      type="button"
                      disabled={navigatingJobId !== null}
                      onClick={() => {
                        if (navigatingJobId) return;
                        setNavigatingJobId(job.id);
                        setSelectedJobId(job.id);
                        if (!hasAnalysis) {
                          markPendingAnalysisJobId(job.id);
                        }
                        router.push("/results");
                      }}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {navigatingJobId === job.id
                        ? "Opening..."
                        : hasAnalysis
                          ? "See analysis"
                          : "Analyze fit"}
                    </button>
                    {isUserAdded && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingJobId === job.id) {
                              setEditingJobId(null);
                              return;
                            }
                            openEditor(job);
                          }}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                        >
                          View/Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${job.title}`}
                          title="Remove job"
                          onClick={() => {
                            const ok = confirm(
                              "Are you sure you want to delete this job?",
                            );
                            if (!ok) return;
                            deleteUserJob(job.id);
                            refreshData();
                            notifySessionDataChanged();
                          }}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
                        >
                          ×
                        </button>
                      </>
                    )}
                    </div>
                  </div>
                </div>
                {isUserAdded && editingJobId === job.id && (
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder="Job title"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                      />
                      <input
                        type="text"
                        value={editCompany}
                        onChange={(event) => setEditCompany(event.target.value)}
                        placeholder="Company"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                      />
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(event) => setEditLocation(event.target.value)}
                        placeholder="Location (optional)"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                      />
                    </div>
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Job description"
                      className="mt-2 min-h-28 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = updateUserJob(job.id, {
                            title: editTitle.trim() || "Untitled job",
                            company: editCompany.trim() || "Unknown company",
                            location: editLocation.trim(),
                            description: editDescription.trim() || job.description,
                          });
                          refreshData();
                          notifySessionDataChanged();
                          setEditingJobId(null);
                          if (!updated) return;
                        }}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingJobId(null)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        )}
      </section>
    </>
  );
}
