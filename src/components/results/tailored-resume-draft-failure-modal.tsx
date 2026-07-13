"use client";

import {
  messageForTailoredDraftFailureCode,
  normalizeTailoredDraftFailureCode,
  type TailoredDraftFailureCode,
} from "@/lib/tailored-draft-flow-messages";

type TailoredResumeDraftFailureModalProps = {
  open: boolean;
  message?: string | null;
  failureCode?: TailoredDraftFailureCode | string | null;
  canRetry?: boolean;
  onRetryNow: () => void;
  onTryLater: () => void;
};

export function TailoredResumeDraftFailureModal({
  open,
  message,
  failureCode,
  canRetry = true,
  onRetryNow,
  onTryLater,
}: TailoredResumeDraftFailureModalProps) {
  if (!open) {
    return null;
  }

  const normalizedCode = normalizeTailoredDraftFailureCode(failureCode ?? undefined);
  const mappedMessage = normalizedCode
    ? messageForTailoredDraftFailureCode(normalizedCode).message
    : null;
  const displayMessage =
    message?.trim() ||
    mappedMessage ||
    messageForTailoredDraftFailureCode("unknown_error").message;

  return (
    <div
      className="fixed inset-0 z-[72] flex items-center justify-center bg-zinc-900/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tailored-draft-failure-title"
      aria-describedby="tailored-draft-failure-description"
    >
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 id="tailored-draft-failure-title" className="text-lg font-semibold text-zinc-900">
          Couldn&apos;t draft tailored resume
        </h2>
        <p id="tailored-draft-failure-description" className="mt-2 text-sm text-zinc-600">
          {displayMessage}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {canRetry ? (
            <button
              type="button"
              onClick={onRetryNow}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Retry draft
            </button>
          ) : null}
          <button
            type="button"
            onClick={onTryLater}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Try later
          </button>
        </div>
      </section>
    </div>
  );
}
