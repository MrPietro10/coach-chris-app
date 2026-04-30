"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { buildSessionJobId, saveUserJob } from "@/lib/job-session-store";
import { logEvent } from "@/lib/alpha-usage-logger";

export default function AnalyzePage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [locationInput, setLocationInput] = useState("");

  function saveFromInput() {
    if (descriptionInput.trim().length === 0) {
      setMessage("Paste a job description before analyzing.");
      return;
    }

    const cleanTitle = titleInput.trim() || "Untitled job";
    const cleanCompany = companyInput.trim() || "Unknown company";
    const cleanLocation = locationInput.trim();

    saveUserJob({
      id: buildSessionJobId(),
      title: cleanTitle,
      company: cleanCompany,
      location: cleanLocation,
      source: "pasted_text",
      description: descriptionInput.trim(),
      requiredSkills: [],
    });
    logEvent("add_job", { jobTitle: cleanTitle });
    logEvent("run_analysis", { jobTitle: cleanTitle });
    setMessage(`Saved "${cleanTitle}" to your jobs list.`);
    router.push("/batch");
  }

  return (
    <>
      <PageHeader
        title="Let's start with a job."
        subtitle="Paste the job description below and I'll tell you how well you match."
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
        <textarea
          value={descriptionInput}
          onChange={(event) => setDescriptionInput(event.target.value)}
          placeholder="Paste the full job description here..."
          className="mt-3 min-h-32 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={saveFromInput}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Analyze this job
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
