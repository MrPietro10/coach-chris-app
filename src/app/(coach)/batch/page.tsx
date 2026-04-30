 "use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FitBadge } from "@/components/ui/fit-badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  updateUserJob,
  getComputedJobAnalysesState,
  deleteUserJob,
  getAllStoredJobs,
  getAnalyzedJobsState,
  setSelectedJobId,
  type AnalyzedJobsState,
  type ComputedJobAnalysesState,
} from "@/lib/job-session-store";
import {
  analyses,
  getStoredJobStatuses,
  getStoredJobStatusTimestamps,
  jobs,
  setStoredJobStatus,
  type JobStatusTimestampMap,
} from "@/mock-data/career-coach";
import type { JobPosting, JobStatus, JobStatusMap } from "@/types/coach";

export default function BatchPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [allJobs, setAllJobs] = useState<JobPosting[]>(jobs);
  const [analyzedJobsState, setAnalyzedJobsState] = useState<AnalyzedJobsState>({});
  const [computedAnalysesState, setComputedAnalysesState] = useState<ComputedJobAnalysesState>({});
  const [jobStatuses, setJobStatuses] = useState<JobStatusMap>({});
  const [jobStatusTimestamps, setJobStatusTimestamps] = useState<JobStatusTimestampMap>({});
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    const refresh = () => {
      setAllJobs(getAllStoredJobs(jobs));
      setAnalyzedJobsState(getAnalyzedJobsState());
      setComputedAnalysesState(getComputedJobAnalysesState());
      setJobStatuses(getStoredJobStatuses());
      setJobStatusTimestamps(getStoredJobStatusTimestamps());
    };
    refresh();
    setMounted(true);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const staticAnalysisMap = useMemo(() => {
    return new Map(analyses.map((analysis) => [analysis.jobId, analysis]));
  }, []);
  const baseJobIds = useMemo(() => new Set(jobs.map((job) => job.id)), []);

  function refreshData() {
    setAllJobs(getAllStoredJobs(jobs));
    setAnalyzedJobsState(getAnalyzedJobsState());
    setComputedAnalysesState(getComputedJobAnalysesState());
    setJobStatuses(getStoredJobStatuses());
    setJobStatusTimestamps(getStoredJobStatusTimestamps());
  }

  function openEditor(job: JobPosting) {
    setEditingJobId(job.id);
    setEditTitle(job.title);
    setEditCompany(job.company);
    setEditLocation(job.location);
    setEditDescription(job.description);
  }

  if (!mounted) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Manage saved jobs and open analysis for a selected role."
      />
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Saved jobs</h2>
        {allJobs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Start by adding your first job</p>
        ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {allJobs.map((job) => {
            const computed = computedAnalysesState[job.id];
            const analysis = staticAnalysisMap.get(job.id) ?? (computed?.analysisState === "ready" ? computed : undefined);
            const hasAnalysis = Boolean(analysis) || analyzedJobsState[job.id] === true;
            const isUserAdded = !baseJobIds.has(job.id);
            const status: JobStatus = jobStatuses[job.id] ?? (hasAnalysis ? "Analyzed" : "Analyzed");
            const appliedAt = jobStatusTimestamps[job.id];
            return (
              <li key={job.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{job.title}</p>
                    <p className="text-xs text-zinc-500">{job.company} · {job.location || "No location"}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Status: {status}
                      {status === "Applied" && appliedAt ? ` · Applied ${new Date(appliedAt).toLocaleDateString()}` : ""}
                    </p>
                    {computed?.analysisState === "insufficient_evidence" && (
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                        <span>Insufficient evidence for fit score.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJobId(job.id);
                            router.push("/results");
                          }}
                          className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                        >
                          Complete analysis
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    {analysis && <FitBadge fit={analysis.fit} score={analysis.score} />}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobId(job.id);
                        router.push("/results");
                      }}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      {hasAnalysis ? "See analysis" : "Analyze fit"}
                    </button>
                    {status !== "For Interview" && (
                      <button
                        type="button"
                        onClick={() => {
                          setStoredJobStatus(job.id, "For Interview");
                          refreshData();
                        }}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                      >
                        Mark for interview
                      </button>
                    )}
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
                          }}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
                        >
                          ×
                        </button>
                      </>
                    )}
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
