"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ALPHA_SESSION_CHANGED_EVENT } from "@/lib/alpha-session-store";
import { JOB_WORKSPACE_CHANGED_EVENT } from "@/lib/job-session-store";
import {
  getAnalysisResumeOptionMeta,
  getMostRecentlyUploadedResume,
} from "@/lib/resume-version-display";
import { ResumeVersionMetadataLines } from "@/components/resume/resume-version-metadata-lines";
import {
  getActiveResumeId,
  getActiveResumeRecord,
  getAllResumeRecords,
  RESUME_STORAGE_CHANGED_EVENT,
  type StoredResumeRecord,
} from "@/lib/resume-store";

type AnalysisResumeSelectorProps = {
  selectedResumeId: string | null;
  onSelect: (resumeId: string) => void;
  disabled?: boolean;
};

function ResumeOptionDetails({
  record,
  activeResumeId,
  mostRecentlyUploadedId,
}: {
  record: StoredResumeRecord;
  activeResumeId: string | null;
  mostRecentlyUploadedId: string | null;
}) {
  const meta = getAnalysisResumeOptionMeta(record, activeResumeId, {
    mostRecentlyUploadedId,
  });

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-zinc-900">{meta.name}</p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-600">
        <ResumeVersionMetadataLines
          record={record}
          activeResumeId={activeResumeId}
          mostRecentlyUploadedId={mostRecentlyUploadedId}
        />
      </ul>
    </div>
  );
}

export function AnalysisResumeSelector({
  selectedResumeId,
  onSelect,
  disabled = false,
}: AnalysisResumeSelectorProps) {
  const [resumes, setResumes] = useState<StoredResumeRecord[]>(() =>
    typeof window === "undefined" ? [] : getAllResumeRecords(),
  );
  const [activeResumeId, setActiveResumeId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getActiveResumeId(),
  );

  function refresh(): void {
    setResumes(getAllResumeRecords());
    setActiveResumeId(getActiveResumeId());
  }

  useEffect(() => {
    window.addEventListener(RESUME_STORAGE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
    window.addEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(RESUME_STORAGE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
      window.removeEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
    };
  }, []);

  const activeResume = useMemo(
    () =>
      activeResumeId
        ? resumes.find((resume) => resume.id === activeResumeId) ?? getActiveResumeRecord()
        : null,
    [activeResumeId, resumes],
  );

  const mostRecentlyUploaded = useMemo(
    () => getMostRecentlyUploadedResume(resumes),
    [resumes],
  );
  const hasMultipleVersions = resumes.length > 1;

  const effectiveSelectedId = selectedResumeId ?? activeResumeId ?? resumes[0]?.id ?? null;

  if (resumes.length === 0) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
        <p className="text-sm font-medium text-amber-950">No resume saved yet</p>
        <p className="mt-1 text-xs text-amber-900/90">
          Upload or create a resume before running fit analysis.{" "}
          <Link href="/resume" className="font-medium underline-offset-2 hover:underline">
            Go to Resume
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Resume for analysis</p>

      {activeResume ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-950">Current active resume</p>
          <div className="mt-1.5">
            <ResumeOptionDetails
              record={activeResume}
              activeResumeId={activeResumeId}
              mostRecentlyUploadedId={mostRecentlyUploaded?.id ?? null}
            />
          </div>
        </div>
      ) : null}

      {mostRecentlyUploaded && mostRecentlyUploaded.id !== activeResume?.id ? (
        <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
          Most recently uploaded:{" "}
          <span className="font-medium">{mostRecentlyUploaded.name}</span>. It is selected below
          when it is your active resume.
        </p>
      ) : null}

      {hasMultipleVersions ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-900">Choose resume for this job analysis</p>
          <p className="mt-0.5 text-xs text-zinc-600">
            Pick which version Coach Chris should compare to this job. Uploading a new resume saves
            a separate version and does not overwrite tailored resumes.
          </p>
          <div className="mt-3 space-y-2">
            {resumes.map((resume) => {
              const isSelected = resume.id === effectiveSelectedId;
              return (
                <label
                  key={resume.id}
                  className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "border-zinc-900/20 bg-white shadow-sm"
                      : "border-zinc-200 bg-white/70 hover:border-zinc-300"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="analysis-resume-version"
                    value={resume.id}
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => onSelect(resume.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-zinc-900"
                  />
                  <ResumeOptionDetails
                    record={resume}
                    activeResumeId={activeResumeId}
                    mostRecentlyUploadedId={mostRecentlyUploaded?.id ?? null}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-600">
          One saved version will be used for this analysis. Duplicate it on the{" "}
          <Link href="/resume" className="font-medium underline-offset-2 hover:underline">
            Resume page
          </Link>{" "}
          to tailor for another role.
        </p>
      )}
    </section>
  );
}
