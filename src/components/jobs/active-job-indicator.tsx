"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ALPHA_SESSION_CHANGED_EVENT } from "@/lib/alpha-session-store";
import {
  ACTIVE_JOB_CHANGED_EVENT,
  activeJobLabel,
  getActiveJobSnapshot,
  type ActiveJobSnapshot,
} from "@/lib/active-job";
import { JOB_WORKSPACE_CHANGED_EVENT } from "@/lib/job-session-store";
import { jobs } from "@/mock-data/career-coach";

const EMPTY_SNAPSHOT: ActiveJobSnapshot = {
  activeJobId: null,
  analyzingJobId: null,
  activeJob: null,
  activeJobView: null,
  isAnalyzingActiveJob: false,
  savedJobCount: 0,
};

export function ActiveJobIndicator() {
  const [snapshot, setSnapshot] = useState<ActiveJobSnapshot>(() =>
    typeof window === "undefined" ? EMPTY_SNAPSHOT : getActiveJobSnapshot(jobs),
  );

  useEffect(() => {
    const refresh = () => setSnapshot(getActiveJobSnapshot(jobs));
    window.addEventListener(ACTIVE_JOB_CHANGED_EVENT, refresh);
    window.addEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
    window.addEventListener("career-coach:analysis-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(ACTIVE_JOB_CHANGED_EVENT, refresh);
      window.removeEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
      window.removeEventListener("career-coach:analysis-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
    };
  }, []);

  if (snapshot.savedJobCount === 0) {
    return (
      <p className="hidden text-[11px] text-zinc-500 lg:block">
        No saved jobs —{" "}
        <Link href="/analyze" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
          add a job
        </Link>
      </p>
    );
  }

  if (!snapshot.activeJob) {
    return (
      <p className="hidden text-[11px] text-zinc-500 lg:block">
        {snapshot.savedJobCount} saved job{snapshot.savedJobCount === 1 ? "" : "s"} —{" "}
        <Link href="/batch" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
          choose active job
        </Link>
      </p>
    );
  }

  const label = activeJobLabel(snapshot);

  return (
    <p className="hidden max-w-xs truncate text-[11px] text-zinc-600 lg:block" title={label}>
      <span className="font-medium text-sky-900">Active job:</span> {snapshot.activeJob.title}
      {snapshot.isAnalyzingActiveJob ? (
        <span className="text-amber-800"> · analyzing fit</span>
      ) : null}
      {snapshot.savedJobCount > 1 ? (
        <span className="text-zinc-500">
          {" "}
          ·{" "}
          <Link href="/batch" className="underline-offset-2 hover:underline">
            switch
          </Link>
        </span>
      ) : null}
    </p>
  );
}
