"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JobUrlImport } from "@/components/analyze/job-url-import";
import { CoachChrisIntro } from "@/components/onboarding/coach-chris-intro";
import { PageHeader } from "@/components/ui/page-header";
import {
  buildSessionJobId,
  markPendingAnalysisJobId,
  saveUserJob,
  setSelectedJobId,
} from "@/lib/job-session-store";
import { logEvent } from "@/lib/alpha-usage-logger";

export default function AnalyzePage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [descriptionSource, setDescriptionSource] = useState<"manual" | "imported_url">("manual");

  function saveFromInput() {
    if (isSaving) return;

    if (descriptionInput.trim().length === 0) {
      setMessage("Paste a job description before analyzing.");
      return;
    }

    setIsSaving(true);
    const cleanTitle = titleInput.trim() || "Untitled job";
    const cleanCompany = companyInput.trim() || "Unknown company";
    const cleanLocation = locationInput.trim();
    const jobId = buildSessionJobId();

    saveUserJob({
      id: jobId,
      title: cleanTitle,
      company: cleanCompany,
      location: cleanLocation,
      source: descriptionSource === "imported_url" ? "pasted_url" : "pasted_text",
      description: descriptionInput.trim(),
      requiredSkills: [],
    });
    setSelectedJobId(jobId);
    markPendingAnalysisJobId(jobId);
    logEvent("add_job", { jobTitle: cleanTitle });
    setMessage(`Saved "${cleanTitle}". Opening analysis...`);
    router.push("/results");
  }

  return (
    <>
      <CoachChrisIntro variant="compact" activeStep={2} />
      <PageHeader
        title="Step 2: Add a job to compare"
        subtitle="Paste a job description. Coach Chris will compare your resume to this role and show fit, gaps, and application guidance."
      />
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={titleInput}
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder="Job title"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <input
            type="text"
            value={companyInput}
            onChange={(event) => setCompanyInput(event.target.value)}
            placeholder="Company"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <input
            type="text"
            value={locationInput}
            onChange={(event) => setLocationInput(event.target.value)}
            placeholder="Location (optional)"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
        </div>
        <label htmlFor="job-description" className="mt-4 block text-xs font-medium text-zinc-700">
          Job description
        </label>
        <textarea
          id="job-description"
          value={descriptionInput}
          onChange={(event) => {
            setDescriptionInput(event.target.value);
            setDescriptionSource("manual");
          }}
          placeholder="Paste the full job description here..."
          className="mt-2 min-h-32 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
        />
        <JobUrlImport
          disabled={isSaving}
          onImported={({ description, suggestedTitle }) => {
            setDescriptionInput(description);
            setDescriptionSource("imported_url");
            if (suggestedTitle && titleInput.trim().length === 0) {
              setTitleInput(suggestedTitle);
            }
            setMessage(null);
          }}
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={saveFromInput}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving job..." : "Compare resume to this job"}
          </button>
        </div>
      </section>
      {message && (
        <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          {message}
        </p>
      )}
    </>
  );
}
