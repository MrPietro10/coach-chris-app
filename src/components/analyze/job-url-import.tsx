"use client";

import { useState } from "react";
import { JobUrlImportStatus } from "@/components/analyze/job-url-import-status";
import {
  flowStatusFromImportCode,
  logImportDiagnosticsInDev,
  type JobUrlImportFlowStatus,
  type JobUrlImportStatusDetail,
} from "@/lib/job-url-import-client";
import type { JobUrlImportDiagnostics } from "@/lib/job-url-import-diagnostics";
import type { JobUrlImportErrorCode } from "@/lib/job-url-import-messages";
import {
  getUserFacingJobUrlImportError,
  JOB_URL_IMPORT_HELPER_COPY,
  normalizeImportFailureCode,
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
        diagnostics?: JobUrlImportDiagnostics;
      };

      if (!response.ok) {
        const rawCode = (payload.code ?? "fetch_failed") as JobUrlImportErrorCode;
        const code = normalizeImportFailureCode(rawCode, {
          hostname: payload.diagnostics?.urlHost,
        });
        const copy = getUserFacingJobUrlImportError(code);
        logImportDiagnosticsInDev(payload.diagnostics);
        setFlowStatus(flowStatusFromImportCode(code));
        setStatusDetail({
          title: payload.title ?? copy.title,
          message: payload.error ?? copy.message,
          hint: payload.hint ?? copy.hint ?? null,
        });
        logEvent("import_job_url_failed", {
          code,
          status: response.status,
          urlHost: payload.diagnostics?.urlHost,
          failureReason: payload.diagnostics?.failureReason,
        });
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

      setFlowStatus("idle");
      clearStatus();
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
    <div className="space-y-3">
      <label htmlFor="job-url-import" className="text-sm font-medium text-zinc-900">
        Job posting URL
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          id="job-url-import"
          type="url"
          inputMode="url"
          value={jobUrl}
          onChange={(event) => setJobUrl(event.target.value)}
          placeholder="https://company.com/careers/role-id"
          disabled={disabled || isImporting}
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 shadow-sm"
        />
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={disabled || isImporting || jobUrl.trim().length === 0}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isImporting ? "Importing…" : "Import job"}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">{JOB_URL_IMPORT_HELPER_COPY}</p>
      <JobUrlImportStatus
        status={flowStatus}
        title={statusDetail.title}
        message={statusDetail.message}
        hint={statusDetail.hint}
      />
    </div>
  );
}
