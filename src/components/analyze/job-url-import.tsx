"use client";

import { useRef, useState } from "react";
import { JobUrlImportFailureModal } from "@/components/analyze/job-url-import-failure-modal";
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
  getJobUrlImportFailureModalMessage,
  JOB_URL_IMPORT_FAILURE_INLINE_HINT,
  JOB_URL_IMPORT_FAILURE_MODAL_TITLE,
  JOB_URL_IMPORT_HELPER_COPY,
  normalizeImportFailureCode,
} from "@/lib/job-url-import-messages";
import { logEvent } from "@/lib/alpha-usage-logger";

export type JobUrlImportPartialFields = {
  suggestedTitle?: string | null;
  company?: string | null;
  location?: string | null;
};

type JobUrlImportProps = {
  onImported: (payload: {
    description: string;
    suggestedTitle: string | null;
    company: string | null;
    location: string | null;
    extractionQuality: "good" | "fair" | "weak";
    reviewHint: string | null;
    sourceUrl: string;
  }) => void;
  onPasteManually?: (fields: JobUrlImportPartialFields) => void;
  disabled?: boolean;
};

type ImportFailureState = {
  code: JobUrlImportErrorCode;
  partialFields: JobUrlImportPartialFields;
};

export function JobUrlImport({ onImported, onPasteManually, disabled = false }: JobUrlImportProps) {
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [flowStatus, setFlowStatus] = useState<JobUrlImportFlowStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<JobUrlImportStatusDetail>({
    title: null,
    message: null,
    hint: null,
  });
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [failureState, setFailureState] = useState<ImportFailureState | null>(null);
  const [showSubtleInlineFailure, setShowSubtleInlineFailure] = useState(false);

  const isImporting = flowStatus === "importing";

  function clearStatus(): void {
    setStatusDetail({ title: null, message: null, hint: null });
    setShowSubtleInlineFailure(false);
  }

  function openFailureModal(
    code: JobUrlImportErrorCode,
    partialFields: JobUrlImportPartialFields,
  ): void {
    setFailureState({ code, partialFields });
    setFailureModalOpen(true);
    setShowSubtleInlineFailure(false);
    setFlowStatus(flowStatusFromImportCode(code));
    setStatusDetail({ title: null, message: null, hint: null });
  }

  function closeFailureModal(options?: { showSubtleInline?: boolean }): void {
    setFailureModalOpen(false);
    if (options?.showSubtleInline && failureState) {
      setShowSubtleInlineFailure(true);
      setStatusDetail({
        title: null,
        message: null,
        hint: JOB_URL_IMPORT_FAILURE_INLINE_HINT,
      });
    }
  }

  function handlePasteManually(): void {
    const partialFields = failureState?.partialFields ?? {};
    closeFailureModal({ showSubtleInline: true });
    onPasteManually?.(partialFields);
  }

  function handleTryAnotherLink(): void {
    closeFailureModal();
    setFailureState(null);
    setFlowStatus("idle");
    clearStatus();
    urlInputRef.current?.focus();
    urlInputRef.current?.select();
  }

  function handleCancelFailureModal(): void {
    closeFailureModal({ showSubtleInline: true });
  }

  async function handleImport(): Promise<void> {
    const trimmedUrl = jobUrl.trim();
    if (!trimmedUrl || isImporting || disabled) {
      return;
    }

    setFlowStatus("importing");
    clearStatus();
    setFailureModalOpen(false);
    setFailureState(null);

    try {
      const response = await fetch("/api/coach/import-job-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const payload = (await response.json()) as {
        description?: string;
        suggestedTitle?: string | null;
        company?: string | null;
        location?: string | null;
        extractionQuality?: "good" | "fair" | "weak";
        reviewHint?: string | null;
        sourceUrl?: string;
        error?: string;
        title?: string;
        hint?: string;
        code?: string;
        provider?: string;
        diagnostics?: JobUrlImportDiagnostics;
      };

      const partialFields: JobUrlImportPartialFields = {
        suggestedTitle: payload.suggestedTitle ?? null,
        company: payload.company ?? null,
        location: payload.location ?? null,
      };

      if (!response.ok) {
        const rawCode = (payload.code ?? "fetch_failed") as JobUrlImportErrorCode;
        const code = normalizeImportFailureCode(rawCode, {
          hostname: payload.diagnostics?.urlHost,
        });
        logImportDiagnosticsInDev(payload.diagnostics);
        logEvent("import_job_url_failed", {
          code,
          status: response.status,
          urlHost: payload.diagnostics?.urlHost,
          failureReason: payload.diagnostics?.failureReason,
        });
        openFailureModal(code, partialFields);
        return;
      }

      const description = payload.description?.trim() ?? "";
      if (!description) {
        openFailureModal("empty_extraction", partialFields);
        return;
      }

      onImported({
        description,
        suggestedTitle: payload.suggestedTitle ?? null,
        company: payload.company ?? null,
        location: payload.location ?? null,
        extractionQuality: payload.extractionQuality ?? "good",
        reviewHint: payload.reviewHint ?? null,
        sourceUrl: payload.sourceUrl ?? trimmedUrl,
      });

      setFlowStatus("idle");
      clearStatus();
      logEvent("import_job_url_success", { provider: payload.provider ?? "fetch-html" });
    } catch {
      logEvent("import_job_url_failed", { code: "fetch_failed" });
      openFailureModal("fetch_failed", {});
    }
  }

  const failureModalMessage = failureState
    ? getJobUrlImportFailureModalMessage(failureState.code)
    : JOB_URL_IMPORT_FAILURE_MODAL_TITLE;

  return (
    <>
      <div className="space-y-3">
        <label htmlFor="job-url-import" className="text-sm font-medium text-zinc-900">
          Job posting URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            ref={urlInputRef}
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
          subtle={showSubtleInlineFailure}
        />
      </div>

      <JobUrlImportFailureModal
        open={failureModalOpen}
        title={JOB_URL_IMPORT_FAILURE_MODAL_TITLE}
        message={failureModalMessage}
        onPasteManually={handlePasteManually}
        onTryAnotherLink={handleTryAnotherLink}
        onCancel={handleCancelFailureModal}
      />
    </>
  );
}
