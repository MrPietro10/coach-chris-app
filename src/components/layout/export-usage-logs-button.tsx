"use client";

import { exportUsageLogs } from "@/lib/alpha-usage-logger";

export function ExportUsageLogsButton() {
  return (
    <button
      type="button"
      onClick={() => exportUsageLogs()}
      className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      Export usage logs
    </button>
  );
}
