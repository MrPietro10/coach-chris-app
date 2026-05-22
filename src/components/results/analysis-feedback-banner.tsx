"use client";

import { ANALYSIS_PROGRESS_STEPS } from "@/lib/analysis-flow-messages";

export type AnalysisFeedbackStatus = "idle" | "running" | "success" | "failed";

type AnalysisFeedbackBannerProps = {
  status: AnalysisFeedbackStatus;
  message: string | null;
  progressStep?: string;
};

function statusStyles(status: AnalysisFeedbackStatus): string {
  switch (status) {
    case "running":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    default:
      return "";
  }
}

function statusLabel(status: AnalysisFeedbackStatus): string {
  switch (status) {
    case "running":
      return "Analysis running";
    case "success":
      return "Analysis complete";
    default:
      return "";
  }
}

export function AnalysisFeedbackBanner({
  status,
  message,
  progressStep,
}: AnalysisFeedbackBannerProps) {
  if (status === "idle" || status === "failed" || !message) {
    return null;
  }

  return (
    <section
      className={`rounded-xl border px-4 py-3 ${statusStyles(status)}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {statusLabel(status)}
          </p>
          <p className="mt-1 text-sm font-medium">{message}</p>
          {status === "running" && progressStep ? (
            <p className="mt-1 text-xs opacity-90">{progressStep}</p>
          ) : null}
        </div>
        {status === "running" ? (
          <span
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : null}
      </div>

      {status === "running" ? (
        <ul className="mt-2 space-y-0.5" aria-label="Analysis progress">
          {ANALYSIS_PROGRESS_STEPS.map((step) => (
            <li
              key={step}
              className={`text-[11px] ${
                progressStep === step ? "font-semibold opacity-100" : "opacity-50"
              }`}
            >
              {step}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
