"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { PageHeader } from "@/components/ui/page-header";
import {
  getStoredResumeInput,
  saveStoredResumeInput,
} from "@/lib/job-session-store";

function readStoredResumeInput(): string {
  const stored = getStoredResumeInput();
  return stored.summary || stored.highlights || "";
}

export default function ResumePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const [resumeInput, setResumeInput] = useState(() =>
    typeof window === "undefined" ? "" : readStoredResumeInput(),
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!isClient) {
    return null;
  }

  function persistResume(): boolean {
    const value = resumeInput.trim();
    if (!value) {
      setNotice("Paste your resume here to begin");
      return false;
    }

    saveStoredResumeInput({
      summary: value,
      skills: "",
      highlights: "",
    });
    return true;
  }

  return (
    <>
      <PageHeader
        title="Resume"
        subtitle="Start here by pasting your resume. Chris uses it when scoring jobs and suggesting improvements."
      />
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <label htmlFor="resume-input" className="text-sm font-medium text-zinc-900">
          Resume input
        </label>
        <textarea
          id="resume-input"
          value={resumeInput}
          onChange={(event) => {
            setResumeInput(event.target.value);
            if (notice) setNotice(null);
          }}
          placeholder="Paste your resume here to begin"
          className="mt-3 min-h-48 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!persistResume()) return;
              setNotice("Resume saved.");
            }}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Save resume
          </button>
          <button
            type="button"
            onClick={() => {
              if (!persistResume()) return;
              router.push("/analyze");
            }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Continue to job analysis
          </button>
        </div>
        {notice && (
          <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            {notice}
          </p>
        )}
      </section>
    </>
  );
}
