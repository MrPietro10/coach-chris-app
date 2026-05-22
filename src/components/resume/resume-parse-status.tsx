"use client";

import type { ResumeParseFlowStatus } from "@/lib/resume-upload";

type ResumeParseStatusProps = {
  status: ResumeParseFlowStatus;
  fileName?: string | null;
  title?: string | null;
  message?: string | null;
  hint?: string | null;
};

function statusStyles(status: ResumeParseFlowStatus): string {
  switch (status) {
    case "uploading":
    case "parsing":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "parse_success":
    case "resume_ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "parse_failure":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "unsupported":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

function statusLabel(status: ResumeParseFlowStatus): string {
  switch (status) {
    case "uploading":
      return "Uploading";
    case "parsing":
      return "Parsing";
    case "parse_success":
      return "Parsed";
    case "parse_failure":
      return "Parsing failed";
    case "unsupported":
      return "Unsupported file";
    case "resume_ready":
      return "Ready for analysis";
    default:
      return "Ready to upload";
  }
}

export function ResumeParseStatus({
  status,
  fileName,
  title,
  message,
  hint,
}: ResumeParseStatusProps) {
  if (status === "idle") {
    return null;
  }

  const showSpinner = status === "uploading" || status === "parsing";

  return (
    <div
      className={`mt-3 rounded-lg border px-3 py-2.5 text-xs ${statusStyles(status)}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold uppercase tracking-wide">{statusLabel(status)}</span>
        {showSpinner ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {fileName ? <span className="text-[11px] opacity-80">{fileName}</span> : null}
      </div>
      {title && status === "parse_failure" ? (
        <p className="mt-1.5 font-medium">{title}</p>
      ) : null}
      {message ? <p className="mt-1">{message}</p> : null}
      {hint ? <p className="mt-1 opacity-90">{hint}</p> : null}
      {status === "parse_success" ? (
        <p className="mt-1 opacity-90">
          Not active for analysis until you save below — then it becomes your analysis resume.
        </p>
      ) : null}
      {status === "resume_ready" ? (
        <p className="mt-1 font-medium">This saved resume is active for job analysis.</p>
      ) : null}
      {status === "parse_failure" && fileName ? (
        <p className="mt-1 opacity-90">Upload received — parsing did not complete.</p>
      ) : null}
    </div>
  );
}
