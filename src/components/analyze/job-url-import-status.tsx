"use client";

import type { JobUrlImportFlowStatus } from "@/lib/job-url-import-client";

type JobUrlImportStatusProps = {
  status: JobUrlImportFlowStatus;
  title?: string | null;
  message?: string | null;
  hint?: string | null;
};

function statusStyles(status: JobUrlImportFlowStatus): string {
  switch (status) {
    case "importing":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "import_success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "import_failure":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "unsupported":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

function statusLabel(status: JobUrlImportFlowStatus): string {
  switch (status) {
    case "importing":
      return "Importing";
    case "import_success":
      return "Import success";
    case "import_failure":
      return "Import failed";
    case "unsupported":
      return "Unsupported page";
    default:
      return "";
  }
}

export function JobUrlImportStatus({
  status,
  title,
  message,
  hint,
}: JobUrlImportStatusProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={`mt-3 rounded-lg border px-3 py-2.5 text-xs ${statusStyles(status)}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold uppercase tracking-wide">{statusLabel(status)}</span>
        {status === "importing" ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
      </div>
      {title && (status === "import_failure" || status === "unsupported") ? (
        <p className="mt-1.5 font-medium">{title}</p>
      ) : null}
      {message ? <p className="mt-1">{message}</p> : null}
      {hint ? <p className="mt-1 opacity-90">{hint}</p> : null}
      {status === "import_success" ? (
        <p className="mt-1 opacity-90">Review the description below, then compare your resume.</p>
      ) : null}
    </div>
  );
}
