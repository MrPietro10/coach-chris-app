 "use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { JobSpreadsheetImport } from "@/components/batch/job-spreadsheet-import";
import { ClearAllJobsConfirmDialog } from "@/components/jobs/clear-all-jobs-confirm-dialog";
import { RemoveJobConfirmDialog } from "@/components/jobs/remove-job-confirm-dialog";
import { JobApplicationTracking } from "@/components/jobs/job-application-tracking";
import { JobActiveBadge } from "@/components/jobs/job-active-badge";
import { FitBadge } from "@/components/ui/fit-badge";
import { PageHeader } from "@/components/ui/page-header";
import { getReadyAnalysisForJob } from "@/lib/analysis-records";
import {
  ACTIVE_JOB_CHANGED_EVENT,
  getActiveJobSnapshot,
  setActiveJob,
} from "@/lib/active-job";
import {
  clearAllJobsFromWorkspace,
  updateUserJob,
  getComputedJobAnalysesState,
  deleteUserJob,
  getAllStoredJobs,
  JOB_WORKSPACE_CHANGED_EVENT,
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
  const searchParams = useSearchParams();
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
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearAllNotice, setClearAllNotice] = useState<string | null>(null);
  const [pendingRemoveJobId, setPendingRemoveJobId] = useState<string | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState(() =>
    typeof window === "undefined"
      ? { activeJobId: null, analyzingJobId: null }
      : {
          activeJobId: getActiveJobSnapshot(jobs).activeJobId,
          analyzingJobId: getActiveJobSnapshot(jobs).analyzingJobId,
        },
  );

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
    window.addEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
    const refreshActive = () => {
      const snapshot = getActiveJobSnapshot(jobs);
      setActiveSnapshot({
        activeJobId: snapshot.activeJobId,
        analyzingJobId: snapshot.analyzingJobId,
      });
    };
    refreshActive();
    window.addEventListener(ACTIVE_JOB_CHANGED_EVENT, refreshActive);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("career-coach:analysis-updated", refresh);
      window.removeEventListener(JOB_PIPELINE_UPDATED_EVENT, refresh);
      window.removeEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
      window.removeEventListener(ACTIVE_JOB_CHANGED_EVENT, refreshActive);
    };
  }, []);

  const baseJobIds = useMemo(() => new Set(jobs.map((job) => job.id)), []);

  function refreshData() {
    setAllJobs(getAllStoredJobs(jobs));
    setComputedAnalysesState(getComputedJobAnalysesState());
    setJobStatuses(getStoredJobStatuses());
    const snapshot = getActiveJobSnapshot(jobs);
    setActiveSnapshot({
      activeJobId: snapshot.activeJobId,
      analyzingJobId: snapshot.analyzingJobId,
    });
  }

  function handleConfirmClearAllJobs(options: { removeLinkedTailoredResumes: boolean }) {
    clearAllJobsFromWorkspace(jobs, options);
    setClearAllDialogOpen(false);
    setClearAllNotice(
      options.removeLinkedTailoredResumes
        ? "Jobs cleared. Linked tailored resumes were removed."
        : "Jobs cleared. You can add a new job anytime.",
    );
    refreshData();
    notifySessionDataChanged();
  }

  function handleConfirmRemoveJob(options: { removeLinkedTailoredResumes: boolean }) {
    if (!pendingRemoveJobId) return;
    deleteUserJob(pendingRemoveJobId, options);
    setPendingRemoveJobId(null);
    refreshData();
    notifySessionDataChanged();
  }

  const pendingRemoveJob = pendingRemoveJobId
    ? allJobs.find((job) => job.id === pendingRemoveJobId)
    : null;

  const urlEditId = searchParams.get("edit")?.trim() || null;

  function openEditor(job: JobPosting) {
    setEditingJobId(job.id);
    setEditTitle(job.title);
    setEditCompany(job.company);
    setEditLocation(job.location);
    setEditDescription(job.description);
  }

  function closeEditor(): void {
    setEditingJobId(null);
    if (urlEditId) {
      router.replace("/batch");
    }
  }

  function isJobEditing(job: JobPosting): boolean {
    if (editingJobId === job.id) return true;
    return editingJobId === null && urlEditId === job.id && !baseJobIds.has(job.id);
  }

  if (!isClient) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Saved jobs"
        subtitle="Jobs you are tracking against your resume. Import a spreadsheet or add one job at a time."
      />
      <JobSpreadsheetImport
        onImported={() => {
          refreshData();
          notifySessionDataChanged();
        }}
      />
      <section className="mt-5 rounded-xl border border-zinc-200/80 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-900">Saved jobs</h2>
          <div className="flex flex-wrap items-center gap-2">
            {activeSnapshot.activeJobId ? (
              <p className="text-xs text-zinc-500">
                Active job is highlighted. Switch anytime — your pipeline and notes stay per role.
              </p>
            ) : null}
            {allJobs.length > 0 ? (
              <button
                type="button"
                onClick={() => setClearAllDialogOpen(true)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
              >
                Clear all jobs
              </button>
            ) : null}
          </div>
        </div>
        {clearAllNotice ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
            {clearAllNotice}
          </p>
        ) : null}
        {allJobs.length === 0 ? (
          <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-4">
            <p className="text-sm text-zinc-600">Add a job description to analyze against your resume.</p>
            <p className="mt-1 text-xs text-zinc-500">
              After you add a role, it appears here so you can reopen fit results anytime.
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
            const isActive = activeSnapshot.activeJobId === job.id;
            const isAnalyzing = activeSnapshot.analyzingJobId === job.id;
            return (
              <li
                key={job.id}
                className={`py-2.5 first:pt-0 last:pb-0 ${isActive ? "rounded-lg border border-sky-100 bg-sky-50/40 px-3 -mx-3" : ""}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900">{job.title}</p>
                      {isActive ? <JobActiveBadge variant="active" /> : null}
                      {isAnalyzing ? <JobActiveBadge variant="analyzing" /> : null}
                    </div>
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
                            setActiveJob(job.id, { analyzeOnOpen: true });
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
                        setActiveJob(job.id, { analyzeOnOpen: !hasAnalysis });
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
                    {!isActive ? (
                      <button
                        type="button"
                        onClick={() => setActiveJob(job.id)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                      >
                        Set active
                      </button>
                    ) : null}
                    {isUserAdded ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isJobEditing(job)) {
                            closeEditor();
                            return;
                          }
                          openEditor(job);
                        }}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                      >
                        {isJobEditing(job) ? "Close editor" : "View/Edit"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Remove ${job.title}`}
                      title="Remove job"
                      onClick={() => setPendingRemoveJobId(job.id)}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
                    >
                      ×
                    </button>
                    </div>
                  </div>
                </div>
                {isUserAdded && isJobEditing(job) ? (
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={editingJobId === job.id ? editTitle : job.title}
                        onChange={(event) => {
                          if (editingJobId !== job.id) openEditor(job);
                          setEditTitle(event.target.value);
                        }}
                        placeholder="Job title"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                      />
                      <input
                        type="text"
                        value={editingJobId === job.id ? editCompany : job.company}
                        onChange={(event) => {
                          if (editingJobId !== job.id) openEditor(job);
                          setEditCompany(event.target.value);
                        }}
                        placeholder="Company"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                      />
                      <input
                        type="text"
                        value={editingJobId === job.id ? editLocation : job.location}
                        onChange={(event) => {
                          if (editingJobId !== job.id) openEditor(job);
                          setEditLocation(event.target.value);
                        }}
                        placeholder="Location (optional)"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                      />
                    </div>
                    <textarea
                      value={editingJobId === job.id ? editDescription : job.description}
                      onChange={(event) => {
                        if (editingJobId !== job.id) openEditor(job);
                        setEditDescription(event.target.value);
                      }}
                      placeholder="Job description"
                      className="mt-2 min-h-28 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const title =
                            (editingJobId === job.id ? editTitle : job.title).trim() || "Untitled job";
                          const company =
                            (editingJobId === job.id ? editCompany : job.company).trim() ||
                            "Unknown company";
                          const location =
                            editingJobId === job.id ? editLocation : job.location;
                          const description =
                            (editingJobId === job.id ? editDescription : job.description).trim() ||
                            job.description;
                          const updated = updateUserJob(job.id, {
                            title,
                            company,
                            location: location.trim(),
                            description,
                          });
                          refreshData();
                          notifySessionDataChanged();
                          closeEditor();
                          if (!updated) return;
                        }}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={closeEditor}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        )}
      </section>

      <ClearAllJobsConfirmDialog
        open={clearAllDialogOpen}
        onCancel={() => setClearAllDialogOpen(false)}
        onConfirm={handleConfirmClearAllJobs}
      />

      <RemoveJobConfirmDialog
        open={Boolean(pendingRemoveJob)}
        jobTitle={pendingRemoveJob?.title ?? "this job"}
        onCancel={() => setPendingRemoveJobId(null)}
        onConfirm={handleConfirmRemoveJob}
      />
    </>
  );
}
