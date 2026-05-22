"use client";

import { ANALYSIS_TEMPORARY_FAILURE_MESSAGE } from "@/lib/analysis-flow-messages";

type AnalysisFailureModalProps = {
  open: boolean;
  message?: string | null;
  canRetry?: boolean;
  onRetryNow: () => void;
  onRunLater: () => void;
};

export function AnalysisFailureModal({
  open,
  message,
  canRetry = true,
  onRetryNow,
  onRunLater,
}: AnalysisFailureModalProps) {
  if (!open) {
    return null;
  }

  const displayMessage = message?.trim() || ANALYSIS_TEMPORARY_FAILURE_MESSAGE;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-failure-title"
      aria-describedby="analysis-failure-description"
    >
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 id="analysis-failure-title" className="text-lg font-semibold text-zinc-900">
          Analysis failed
        </h2>
        <p id="analysis-failure-description" className="mt-2 text-sm text-zinc-600">
          {displayMessage}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {canRetry ? (
            <button
              type="button"
              onClick={onRetryNow}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Retry analysis now
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRunLater}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Run analysis later
          </button>
        </div>
      </section>
    </div>
  );
}
