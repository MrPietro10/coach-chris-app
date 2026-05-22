"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveResumeCallout } from "@/components/resume/active-resume-callout";
import { ResumeParseReviewModal } from "@/components/resume/resume-parse-review-modal";
import { ResumeParseStatus } from "@/components/resume/resume-parse-status";
import { ALPHA_SESSION_CHANGED_EVENT } from "@/lib/alpha-session-store";
import {
  clearStoredResumeUploadState,
  getResumeWorkspaceSnapshot,
  getStoredResumeUploadState,
  RESUME_STORAGE_CHANGED_EVENT,
  markResumeParsed,
  saveStoredResumeDraft,
  saveStoredResumeInput,
  saveStoredResumeUploadState,
  type StoredResumeInput,
  type StoredResumeUploadState,
} from "@/lib/job-session-store";
import { readResumeUiSyncState } from "@/lib/resume-persistence-sync";
import type { ResumeParseErrorCode } from "@/lib/resume-parse-messages";
import {
  getUserFacingParseError,
  PARSE_SUCCESS_MESSAGE,
  RESUME_READY_MESSAGE,
} from "@/lib/resume-parse-messages";
import { getResumeWorkspaceHints, hasResumeFieldContent } from "@/lib/resume-workspace";
import {
  isLegacyDocFile,
  isParseableResumeFile,
  LEGACY_DOC_MESSAGE,
  PARSEABLE_RESUME_LABEL,
  SUPPORTED_RESUME_LABEL,
  type ResumeParseFlowStatus,
  validateResumeUploadFile,
} from "@/lib/resume-upload";

type ResumeWorkspaceProps = {
  onNotice?: (message: string | null) => void;
};

type ParseStatusDetail = {
  title: string | null;
  message: string | null;
  hint: string | null;
};

function mapClientValidationToUnsupported(file: File): ParseStatusDetail | null {
  if (isLegacyDocFile(file.name)) {
    return {
      title: "Unsupported file",
      message: LEGACY_DOC_MESSAGE,
      hint: "Convert to PDF or DOCX and try again.",
    };
  }
  if (!isParseableResumeFile(file.name)) {
    const copy = getUserFacingParseError("unsupported");
    return {
      title: copy.title,
      message: `This file type cannot be parsed. Use ${PARSEABLE_RESUME_LABEL}.`,
      hint: copy.hint ?? null,
    };
  }
  const validationError = validateResumeUploadFile(file);
  if (validationError) {
    return {
      title: "Unsupported file",
      message: validationError,
      hint: "Try PDF or DOCX, or paste your resume below.",
    };
  }
  return null;
}

function mapApiParseError(payload: {
  error?: string;
  title?: string;
  hint?: string;
  code?: string;
}): ParseStatusDetail {
  const code = (payload.code ?? "parse_failed") as ResumeParseErrorCode;
  const copy = getUserFacingParseError(code);
  return {
    title: payload.title ?? copy.title,
    message: payload.error ?? copy.message,
    hint: payload.hint ?? copy.hint ?? null,
  };
}

export function ResumeWorkspace({ onNotice }: ResumeWorkspaceProps) {
  const router = useRouter();
  const initialSync = readResumeUiSyncState();
  const [resumeFields, setResumeFields] = useState<StoredResumeInput>(() => initialSync.fields);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [flowStatus, setFlowStatus] = useState<ResumeParseFlowStatus>(() => initialSync.flowStatus);
  const [statusDetail, setStatusDetail] = useState<ParseStatusDetail>({
    title: null,
    message: null,
    hint: null,
  });
  const [uploadedFile, setUploadedFile] = useState(() => initialSync.upload);
  const [lastParsedFileType, setLastParsedFileType] = useState<"pdf" | "docx" | undefined>(
    () => initialSync.parsedFileType,
  );
  const [parseReviewOpen, setParseReviewOpen] = useState(false);
  const [pendingParseFields, setPendingParseFields] = useState<StoredResumeInput | null>(null);
  const [pendingParsedAt, setPendingParsedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleExternalSync = () => {
      const next = readResumeUiSyncState();
      setResumeFields(next.fields);
      setUploadedFile(next.upload);
      setFlowStatus(next.flowStatus);
      if (next.parsedFileType) {
        setLastParsedFileType(next.parsedFileType);
      }
    };
    window.addEventListener(RESUME_STORAGE_CHANGED_EVENT, handleExternalSync);
    window.addEventListener("storage", handleExternalSync);
    window.addEventListener("focus", handleExternalSync);
    window.addEventListener(ALPHA_SESSION_CHANGED_EVENT, handleExternalSync);
    return () => {
      window.removeEventListener(RESUME_STORAGE_CHANGED_EVENT, handleExternalSync);
      window.removeEventListener("storage", handleExternalSync);
      window.removeEventListener("focus", handleExternalSync);
      window.removeEventListener(ALPHA_SESSION_CHANGED_EVENT, handleExternalSync);
    };
  }, []);

  const snapshot = getResumeWorkspaceSnapshot(resumeFields);
  const hints = getResumeWorkspaceHints(snapshot);
  const displayStatus =
    flowStatus === "idle" && hints.isSavedForAnalysis && !hints.hasUnsavedEdits
      ? "resume_ready"
      : flowStatus;
  const isBusy = displayStatus === "uploading" || displayStatus === "parsing";

  function setNotice(message: string | null): void {
    onNotice?.(message);
  }

  function clearStatusDetail(): void {
    setStatusDetail({ title: null, message: null, hint: null });
  }

  function updateField<K extends keyof StoredResumeInput>(key: K, value: StoredResumeInput[K]): void {
    setResumeFields((current) => {
      const next = { ...current, [key]: value };
      if (hasResumeFieldContent(next)) {
        saveStoredResumeDraft(next);
      }
      return next;
    });
    setNotice(null);
  }

  function confirmResumeForAnalysis(): boolean {
    if (!hasResumeFieldContent(resumeFields)) {
      setNotice("Add your resume below to continue.");
      return false;
    }

    saveStoredResumeInput({
      summary: resumeFields.summary.trim(),
      skills: resumeFields.skills.trim(),
      highlights: resumeFields.highlights.trim(),
    });
    setFlowStatus("resume_ready");
    setStatusDetail({
      title: null,
      message: RESUME_READY_MESSAGE,
      hint: null,
    });
    return true;
  }

  async function handleSelectedFile(file: File): Promise<void> {
    const unsupported = mapClientValidationToUnsupported(file);
    if (unsupported) {
      setFlowStatus("unsupported");
      setStatusDetail(unsupported);
      setUploadedFile(null);
      clearStoredResumeUploadState();
      setNotice(null);
      return;
    }

    const fileType: "pdf" | "docx" = file.name.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
    const uploadState: StoredResumeUploadState = {
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      fileType,
    };

    setFlowStatus("uploading");
    setStatusDetail({
      title: null,
      message: "Uploading your file…",
      hint: null,
    });
    setNotice(null);
    saveStoredResumeUploadState(uploadState);
    setUploadedFile(uploadState);

    await new Promise((resolve) => setTimeout(resolve, 0));

    setFlowStatus("parsing");
    setStatusDetail({
      title: null,
      message: "Parsing resume text…",
      hint: null,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/coach/parse-resume", {
        method: "POST",
        body: formData,
      });

      let payload: {
        error?: string;
        title?: string;
        hint?: string;
        code?: string;
        fileType?: "pdf" | "docx";
        warning?: string;
        summary?: string;
        skills?: string;
        highlights?: string;
      } = {};

      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const detail = mapApiParseError(payload);
        setFlowStatus("parse_failure");
        setStatusDetail(detail);
        if (process.env.NODE_ENV !== "production") {
          console.warn("[resume-workspace] parse_failed", {
            status: response.status,
            code: payload.code,
            fileName: file.name,
          });
        }
        return;
      }

      const parsedFields: StoredResumeInput = {
        summary: payload.summary?.trim() ?? "",
        skills: payload.skills?.trim() ?? "",
        highlights: payload.highlights?.trim() ?? "",
      };

      if (!hasResumeFieldContent(parsedFields)) {
        const detail = getUserFacingParseError("empty_extraction", {
          fileType: payload.fileType === "docx" ? "docx" : "pdf",
        });
        setFlowStatus("parse_failure");
        setStatusDetail({
          title: detail.title,
          message: detail.message,
          hint: detail.hint ?? null,
        });
        if (process.env.NODE_ENV !== "production") {
          console.warn("[resume-workspace] empty_extraction_after_ok", { fileName: file.name });
        }
        return;
      }

      const parsedFileType = payload.fileType === "docx" ? "docx" : "pdf";
      setLastParsedFileType(parsedFileType);
      setUploadedFile(getStoredResumeUploadState());
      const parsedAtStamp = new Date().toISOString();
      setPendingParsedAt(parsedAtStamp);
      setPendingParseFields(parsedFields);
      setParseReviewOpen(true);
      setFlowStatus("parse_success");
      setStatusDetail({
        title: null,
        message: "Review the parsed resume before saving.",
        hint: payload.warning?.trim() || null,
      });
    } catch (error) {
      const detail = getUserFacingParseError("network_error");
      setFlowStatus("parse_failure");
      setStatusDetail({
        title: detail.title,
        message: detail.message,
        hint: detail.hint ?? null,
      });
      if (process.env.NODE_ENV !== "production") {
        console.error("[resume-workspace] network_error", error);
      }
    }
  }

  function clearUploadedFile(): void {
    clearStoredResumeUploadState();
    setUploadedFile(null);
    setFlowStatus(hints.isSavedForAnalysis ? "resume_ready" : "idle");
    clearStatusDetail();
    setNotice("File removed. Your text below is still here.");
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
      <h2 className="text-sm font-medium text-zinc-900">Your resume</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Upload a {PARSEABLE_RESUME_LABEL} or paste below. Save when you are ready — that version is used for
        every job analysis.
      </p>

      <ActiveResumeCallout snapshot={snapshot} inAnalysisContext={hints.isSavedForAnalysis} />

      <ResumeParseStatus
        status={displayStatus}
        fileName={uploadedFile?.fileName}
        title={statusDetail.title}
        message={statusDetail.message}
        hint={statusDetail.hint}
      />

      {hints.hasUnsavedEdits && displayStatus !== "uploading" && displayStatus !== "parsing" ? (
        <p className="mt-3 text-xs text-amber-800">
          Unsaved edits — save to update the resume used for analysis.
        </p>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => !isBusy && fileInputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          const droppedFile = event.dataTransfer.files?.[0];
          if (!droppedFile) return;
          void handleSelectedFile(droppedFile);
        }}
        className={`mt-4 rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${
          isDragActive ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:bg-zinc-50/60"
        } ${isBusy ? "pointer-events-none opacity-60" : ""}`}
      >
        <p className="text-sm text-zinc-700">
          {isBusy ? (displayStatus === "uploading" ? "Uploading…" : "Parsing…") : "Drop PDF or DOCX here"}
        </p>
        {!isBusy ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-3 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50"
          >
            Choose a file
          </button>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">{SUPPORTED_RESUME_LABEL}</p>
        {uploadedFile ? (
          <p className="mt-2 text-xs text-zinc-600">
            {uploadedFile.fileName}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearUploadedFile();
              }}
              className="ml-2 font-medium text-zinc-800 underline-offset-2 hover:underline"
            >
              Remove
            </button>
          </p>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleSelectedFile(file);
          }
          event.currentTarget.value = "";
        }}
      />

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="resume-summary" className="block text-sm font-medium text-zinc-900">
            Summary
          </label>
          <textarea
            id="resume-summary"
            value={resumeFields.summary}
            onChange={(event) => updateField("summary", event.target.value)}
            placeholder="Paste or type your summary"
            className="mt-1.5 min-h-28 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
        </div>
        <div>
          <label htmlFor="resume-skills" className="block text-sm font-medium text-zinc-900">
            Skills
          </label>
          <input
            id="resume-skills"
            type="text"
            value={resumeFields.skills}
            onChange={(event) => updateField("skills", event.target.value)}
            placeholder="Comma-separated"
            className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
        </div>
        <div>
          <label htmlFor="resume-highlights" className="block text-sm font-medium text-zinc-900">
            Experience
          </label>
          <textarea
            id="resume-highlights"
            value={resumeFields.highlights}
            onChange={(event) => updateField("highlights", event.target.value)}
            placeholder="One role or bullet per line"
            className="mt-1.5 min-h-28 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isSaving || isBusy}
          onClick={() => {
            if (isSaving || isBusy) return;
            setIsSaving(true);
            try {
              if (!confirmResumeForAnalysis()) return;
              setNotice(null);
            } finally {
              setIsSaving(false);
            }
          }}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save for analysis"}
        </button>
        <button
          type="button"
          disabled={isSaving || isBusy || !hasResumeFieldContent(resumeFields)}
          onClick={() => {
            if (isSaving || isBusy) return;
            setIsSaving(true);
            try {
              if (!confirmResumeForAnalysis()) return;
              router.push("/analyze");
            } finally {
              setIsSaving(false);
            }
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue to add a job
        </button>
      </div>

      <ResumeParseReviewModal
        open={parseReviewOpen}
        draft={pendingParseFields}
        parsedAt={pendingParsedAt}
        fileType={lastParsedFileType}
        fileName={uploadedFile?.fileName ?? null}
        onConfirm={(confirmed) => {
          const parsedFileType = lastParsedFileType ?? "pdf";
          markResumeParsed(confirmed, {
            fileType: parsedFileType,
            parsedAt: pendingParsedAt ?? undefined,
          });
          setResumeFields(confirmed);
          setPendingParseFields(null);
          setPendingParsedAt(null);
          setParseReviewOpen(false);
          setFlowStatus("parse_success");
          setStatusDetail({
            title: null,
            message: PARSE_SUCCESS_MESSAGE,
            hint: null,
          });
        }}
        onDismiss={() => {
          setParseReviewOpen(false);
          setPendingParseFields(null);
          setPendingParsedAt(null);
          setFlowStatus(hints.isSavedForAnalysis ? "resume_ready" : "idle");
          clearStatusDetail();
          setNotice("Import cancelled. Paste or upload again when ready.");
        }}
      />
    </section>
  );
}
