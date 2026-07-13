"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisResumeSelector } from "@/components/analyze/analysis-resume-selector";
import {
  ImportedJobReviewModal,
  type ImportedJobDraft,
} from "@/components/analyze/imported-job-review-modal";
import { JobUrlImport, type JobUrlImportPartialFields } from "@/components/analyze/job-url-import";
import { CoachChrisIntro } from "@/components/onboarding/coach-chris-intro";
import { PageHeader } from "@/components/ui/page-header";
import { isResumeRecordReadyForAnalysis } from "@/lib/analysis-resume-selection";
import { logEvent } from "@/lib/alpha-usage-logger";
import { setActiveJob } from "@/lib/active-job";
import { parseSuggestedJobTitle } from "@/lib/job-import-cleanup";
import { buildSessionJobId, saveUserJob } from "@/lib/job-session-store";
import { getActiveResumeId, getResumeRecord, RESUME_STORAGE_CHANGED_EVENT } from "@/lib/resume-store";

export default function AnalyzePage() {
  const router = useRouter();
  const manualSectionRef = useRef<HTMLElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevActiveResumeIdRef = useRef<string | null>(getActiveResumeId());
  const [message, setMessage] = useState<string | null>(null);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [descriptionSource, setDescriptionSource] = useState<"manual" | "imported_url">("manual");
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportedJobDraft | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(() => getActiveResumeId());

  useEffect(() => {
    function syncSelectedResumeWithActive(): void {
      const nextActiveId = getActiveResumeId();
      if (nextActiveId && nextActiveId !== prevActiveResumeIdRef.current) {
        setSelectedResumeId(nextActiveId);
        prevActiveResumeIdRef.current = nextActiveId;
      }
    }

    window.addEventListener(RESUME_STORAGE_CHANGED_EVENT, syncSelectedResumeWithActive);
    window.addEventListener("focus", syncSelectedResumeWithActive);
    return () => {
      window.removeEventListener(RESUME_STORAGE_CHANGED_EVENT, syncSelectedResumeWithActive);
      window.removeEventListener("focus", syncSelectedResumeWithActive);
    };
  }, []);

  function applyImportedJob(draft: ImportedJobDraft): void {
    setTitleInput(draft.title);
    setCompanyInput(draft.company);
    setLocationInput(draft.location);
    setDescriptionInput(draft.description);
    setDescriptionSource("imported_url");
    setSourceUrl(draft.sourceUrl);
    setMessage("Job imported. Review the fields below, then run fit analysis when ready.");
    setImportReviewOpen(false);
    setPendingImport(null);
    manualSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handlePasteManuallyFromImport(fields: JobUrlImportPartialFields): void {
    const parsed = fields.suggestedTitle ? parseSuggestedJobTitle(fields.suggestedTitle) : null;

    if (!titleInput.trim()) {
      setTitleInput(parsed?.title || fields.suggestedTitle?.trim() || "");
    }
    if (!companyInput.trim()) {
      setCompanyInput(fields.company?.trim() || parsed?.company || "");
    }
    if (!locationInput.trim() && fields.location?.trim()) {
      setLocationInput(fields.location.trim());
    }

    manualSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => descriptionTextareaRef.current?.focus(), 150);
  }

  function handleImportedFromUrl(payload: {
    description: string;
    suggestedTitle: string | null;
    company: string | null;
    location: string | null;
    extractionQuality: "good" | "fair" | "weak";
    reviewHint: string | null;
    sourceUrl: string;
  }): void {
    const parsed = parseSuggestedJobTitle(payload.suggestedTitle);
    setPendingImport({
      title: parsed.title || payload.suggestedTitle?.trim() || "",
      company: payload.company?.trim() || parsed.company,
      location: payload.location?.trim() || "",
      description: payload.description,
      sourceUrl: payload.sourceUrl,
      importedAt: new Date().toISOString(),
      extractionQuality: payload.extractionQuality,
      reviewHint: payload.reviewHint,
    });
    setImportReviewOpen(true);
    setMessage(null);
  }

  function saveFromInput() {
    if (isSaving) return;

    if (descriptionInput.trim().length === 0) {
      setMessage("Paste a job description before analyzing.");
      return;
    }

    const resumeId = selectedResumeId ?? getActiveResumeId();
    if (!resumeId) {
      setMessage("Add a resume before running fit analysis.");
      return;
    }

    const selectedResume = getResumeRecord(resumeId);
    if (!selectedResume) {
      setMessage("Choose a valid resume version before running analysis.");
      return;
    }

    if (!isResumeRecordReadyForAnalysis(selectedResume)) {
      setMessage(
        "Save your selected resume for analysis on the Resume page before running fit analysis.",
      );
      return;
    }

    setIsSaving(true);
    const cleanTitle = titleInput.trim() || "Untitled job";
    const cleanCompany = companyInput.trim() || "Unknown company";
    const cleanLocation = locationInput.trim();
    const jobId = buildSessionJobId();

    saveUserJob(
      {
        id: jobId,
        title: cleanTitle,
        company: cleanCompany,
        location: cleanLocation,
        source: descriptionSource === "imported_url" ? "pasted_url" : "pasted_text",
        description: descriptionInput.trim(),
        requiredSkills: [],
        jobUrl: sourceUrl,
      },
      { sourceUrl },
    );
    setActiveJob(jobId, { analyzeOnOpen: true, analysisResumeId: resumeId });
    logEvent("add_job", { jobTitle: cleanTitle, resumeId, resumeName: selectedResume.name });
    setMessage(`Saved "${cleanTitle}". Opening analysis with "${selectedResume.name}"...`);
    router.push("/results");
  }

  return (
    <>
      <CoachChrisIntro variant="compact" activeStep={2} />
      <PageHeader
        title="Add a job"
        subtitle="Import from a link or paste the description manually, then analyze how your resume fits this role."
      />

      <div className="space-y-4">
        <AnalysisResumeSelector
          selectedResumeId={selectedResumeId}
          onSelect={setSelectedResumeId}
          disabled={isSaving}
        />

        <section className="rounded-xl border-2 border-zinc-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Add job from link</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Paste a public job posting URL and we&apos;ll pull the description for you.
          </p>
          <div className="mt-4">
            <JobUrlImport
              disabled={isSaving}
              onImported={handleImportedFromUrl}
              onPasteManually={handlePasteManuallyFromImport}
            />
          </div>
        </section>

        <section
          ref={manualSectionRef}
          id="manual-job-section"
          className="rounded-xl border border-zinc-200/80 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-zinc-900">Paste job description manually</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Use this when a link won&apos;t import or you already have the description copied.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              className="col-span-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 sm:col-span-2"
            />
          </div>
          <label htmlFor="job-description" className="mt-4 block text-xs font-medium text-zinc-700">
            Job description
          </label>
          <textarea
            ref={descriptionTextareaRef}
            id="job-description"
            value={descriptionInput}
            onChange={(event) => {
              setDescriptionInput(event.target.value);
              setDescriptionSource("manual");
            }}
            placeholder="Paste the full job description here..."
            className="mt-2 min-h-36 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
        </section>

        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={saveFromInput}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving job..." : "Save and run fit analysis"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          {message}
        </p>
      ) : null}

      <ImportedJobReviewModal
        open={importReviewOpen}
        draft={pendingImport}
        onConfirm={applyImportedJob}
        onDismiss={() => {
          setImportReviewOpen(false);
          setPendingImport(null);
        }}
      />
    </>
  );
}
