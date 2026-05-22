"use client";

import { useState } from "react";
import { JobUrlImportStatus } from "@/components/analyze/job-url-import-status";
import {
  flowStatusFromImportCode,
  type JobUrlImportFlowStatus,
  type JobUrlImportStatusDetail,
} from "@/lib/job-url-import-client";
import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";
import {
  getUserFacingJobUrlImportError,
  JOB_URL_IMPORT_SUCCESS_MESSAGE,
} from "@/lib/job-url-import-messages";
import { logEvent } from "@/lib/alpha-usage-logger";

type JobUrlImportProps = {
  onImported: (payload: {
    description: string;
    suggestedTitle: string | null;
    sourceUrl: string;
  }) => void;
  disabled?: boolean;
};

export function JobUrlImport({ onImported, disabled = false }: JobUrlImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobUrl, setJobUrl] = useState("");
  const [flowStatus, setFlowStatus] = useState<JobUrlImportFlowStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<JobUrlImportStatusDetail>({
    title: null,
    message: null,
    hint: null,
  });

  const isImporting = flowStatus === "importing";

  function clearStatus(): void {
    setStatusDetail({ title: null, message: null, hint: null });
  }

  async function handleImport(): Promise<void> {
    const trimmedUrl = jobUrl.trim();
    if (!trimmedUrl || isImporting || disabled) {
      return;
    }

    setFlowStatus("importing");
    clearStatus();

    try {
      const response = await fetch("/api/coach/import-job-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const payload = (await response.json()) as {
        description?: string;
        suggestedTitle?: string | null;
        sourceUrl?: string;
        error?: string;
        title?: string;
        hint?: string;
        code?: string;
        provider?: string;
      };

      if (!response.ok) {
        const code = (payload.code ?? "fetch_failed") as JobUrlImportErrorCode;
        const copy = getUserFacingJobUrlImportError(code);
        setFlowStatus(flowStatusFromImportCode(code));
        setStatusDetail({
          title: payload.title ?? copy.title,
          message: payload.error ?? copy.message,
          hint: payload.hint ?? copy.hint ?? null,
        });
        logEvent("import_job_url_failed", { code, status: response.status });
        return;
      }

      const description = payload.description?.trim() ?? "";
      if (!description) {
        const copy = getUserFacingJobUrlImportError("empty_extraction");
        setFlowStatus("import_failure");
        setStatusDetail({
          title: copy.title,
          message: copy.message,
          hint: copy.hint ?? null,
        });
        return;
      }

      onImported({
        description,
        suggestedTitle: payload.suggestedTitle ?? null,
        sourceUrl: payload.sourceUrl ?? trimmedUrl,
      });

      setFlowStatus("import_success");
      setStatusDetail({
        title: null,
        message: JOB_URL_IMPORT_SUCCESS_MESSAGE,
        hint: null,
      });
      logEvent("import_job_url_success", { provider: payload.provider ?? "fetch-html" });
    } catch {
      const copy = getUserFacingJobUrlImportError("fetch_failed");
      setFlowStatus("import_failure");
      setStatusDetail({
        title: copy.title,
        message: copy.message,
        hint: copy.hint ?? null,
      });
      logEvent("import_job_url_failed", { code: "fetch_failed" });
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        className="text-xs font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isOpen ? "Hide job link import" : "Import from job link"}
      </button>

      {isOpen ? (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
          <label htmlFor="job-url-import" className="text-xs font-medium text-zinc-700">
            Public job posting URL
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="job-url-import"
              type="url"
              inputMode="url"
              value={jobUrl}
              onChange={(event) => setJobUrl(event.target.value)}
              placeholder="https://company.com/careers/role-id"
              disabled={disabled || isImporting}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
            />
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={disabled || isImporting || jobUrl.trim().length === 0}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? "Importing…" : "Import description"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Public pages only. Login walls, paywalls, and private LinkedIn posts cannot be imported.
          </p>
          <JobUrlImportStatus
            status={flowStatus}
            title={statusDetail.title}
            message={statusDetail.message}
            hint={statusDetail.hint}
          />
        </div>
      ) : null}
    </div>
  );
}
