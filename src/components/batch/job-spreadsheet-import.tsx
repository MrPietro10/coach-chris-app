"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setActiveJob } from "@/lib/active-job";
import { saveImportedUserJobs, type SpreadsheetJobImportInput } from "@/lib/job-session-store";
import { logEvent } from "@/lib/alpha-usage-logger";
import {
  parseSpreadsheetFile,
  type ParsedSpreadsheetJobRow,
  type SpreadsheetParseResult,
} from "@/lib/job-spreadsheet-import";
import {
  SPREADSHEET_IMPORT_FAILURE_MESSAGE,
  SPREADSHEET_IMPORT_SUCCESS_MESSAGE,
  SPREADSHEET_MISSING_COLUMNS_HINT,
} from "@/lib/job-spreadsheet-import-messages";

type JobSpreadsheetImportProps = {
  onImported: () => void;
};

type ImportFlowStatus = "idle" | "parsing" | "preview" | "saved" | "error";

function rowToImportInput(row: ParsedSpreadsheetJobRow): SpreadsheetJobImportInput {
  return {
    title: row.title,
    company: row.company,
    location: row.location,
    jobUrl: row.jobUrl || undefined,
    description: row.description,
  };
}

export function JobSpreadsheetImport({ onImported }: JobSpreadsheetImportProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [flowStatus, setFlowStatus] = useState<ImportFlowStatus>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedSpreadsheetJobRow[]>([]);
  const [parseMeta, setParseMeta] = useState<{
    warnings: string[];
    skippedEmptyRows: number;
    missingColumns: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedJobIdByRow, setSavedJobIdByRow] = useState<Record<number, string>>({});
  const [analyzingRow, setAnalyzingRow] = useState<number | null>(null);

  function resetPreview(): void {
    setFlowStatus("idle");
    setFileName(null);
    setPreviewRows([]);
    setParseMeta(null);
    setErrorMessage(null);
    setSavedJobIdByRow({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function applyParseResult(result: SpreadsheetParseResult, uploadedName: string): void {
    if (!result.ok) {
      setFlowStatus("error");
      setPreviewRows([]);
      setParseMeta(null);
      setErrorMessage(result.error ?? SPREADSHEET_IMPORT_FAILURE_MESSAGE);
      return;
    }

    setFileName(uploadedName);
    setPreviewRows(result.rows);
    setParseMeta({
      warnings: result.warnings,
      skippedEmptyRows: result.skippedEmptyRows,
      missingColumns: result.missingColumns,
    });
    setErrorMessage(null);
    setSavedJobIdByRow({});
    setFlowStatus("preview");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setFlowStatus("parsing");
    setErrorMessage(null);
    setSavedJobIdByRow({});

    const result = await parseSpreadsheetFile(file);
    applyParseResult(result, file.name);
    logEvent("import_jobs_spreadsheet_parsed", {
      fileType: file.name.split(".").pop() ?? "unknown",
      rowCount: result.ok ? result.rows.length : 0,
    });
  }

  function persistRow(row: ParsedSpreadsheetJobRow): string | null {
    const existingId = savedJobIdByRow[row.rowNumber];
    if (existingId) return existingId;

    const saved = saveImportedUserJobs([rowToImportInput(row)]);
    const jobId = saved[0]?.id ?? null;
    if (jobId) {
      setSavedJobIdByRow((prev) => ({ ...prev, [row.rowNumber]: jobId }));
      onImported();
    }
    return jobId;
  }

  function handleSaveAll(): void {
    const unsavedRows = previewRows.filter((row) => !savedJobIdByRow[row.rowNumber]);
    const saved = saveImportedUserJobs(unsavedRows.map(rowToImportInput));
    const nextMap: Record<number, string> = { ...savedJobIdByRow };
    unsavedRows.forEach((row, index) => {
      const jobId = saved[index]?.id;
      if (jobId) nextMap[row.rowNumber] = jobId;
    });
    setSavedJobIdByRow(nextMap);
    setFlowStatus("saved");
    onImported();
    logEvent("import_jobs_spreadsheet_saved", { count: saved.length });
  }

  function handleAnalyzeRow(row: ParsedSpreadsheetJobRow): void {
    setAnalyzingRow(row.rowNumber);
    const jobId = persistRow(row);
    if (!jobId) {
      setAnalyzingRow(null);
      setErrorMessage(SPREADSHEET_IMPORT_FAILURE_MESSAGE);
      return;
    }
    setActiveJob(jobId, { analyzeOnOpen: true });
    logEvent("import_jobs_spreadsheet_analyze", { jobTitle: row.title || row.company });
    router.push("/results");
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
      <h2 className="text-sm font-medium text-zinc-900">Import Jobs Spreadsheet</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Upload CSV or XLSX with columns: title, company, location, job_url, description.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(event) => void handleFileChange(event)}
          disabled={flowStatus === "parsing"}
          className="hidden"
          id="job-spreadsheet-file"
        />
        <label
          htmlFor="job-spreadsheet-file"
          className={`inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 ${
            flowStatus === "parsing" ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Choose CSV or XLSX
        </label>
        {fileName ? <span className="text-xs text-zinc-600">{fileName}</span> : null}
        {flowStatus !== "idle" ? (
          <button
            type="button"
            onClick={resetPreview}
            className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      {flowStatus === "parsing" ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-sky-800">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Parsing spreadsheet…
        </p>
      ) : null}

      {flowStatus === "error" && errorMessage ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <p className="font-medium">Import failed</p>
          <p className="mt-1">{errorMessage}</p>
          <p className="mt-1 opacity-90">{SPREADSHEET_MISSING_COLUMNS_HINT}</p>
        </div>
      ) : null}

      {flowStatus === "preview" || flowStatus === "saved" ? (
        <div className="mt-3">
          {parseMeta?.missingColumns.length ? (
            <p className="text-xs text-amber-800">
              Missing columns: {parseMeta.missingColumns.join(", ")}. Other fields will be blank.
            </p>
          ) : null}
          {parseMeta?.warnings.map((warning) => (
            <p key={warning} className="mt-1 text-xs text-zinc-600">
              {warning}
            </p>
          ))}
          {parseMeta && parseMeta.skippedEmptyRows > 0 ? (
            <p className="mt-1 text-xs text-zinc-500">
              Skipped {parseMeta.skippedEmptyRows} empty or incomplete row
              {parseMeta.skippedEmptyRows === 1 ? "" : "s"}.
            </p>
          ) : null}

          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className="text-zinc-800">
                    <td className="max-w-[8rem] truncate px-3 py-2 font-medium">{row.title || "—"}</td>
                    <td className="max-w-[8rem] truncate px-3 py-2">{row.company || "—"}</td>
                    <td className="max-w-[6rem] truncate px-3 py-2">{row.location || "—"}</td>
                    <td className="max-w-[6rem] truncate px-3 py-2">
                      {row.jobUrl ? (
                        <a
                          href={row.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 hover:underline"
                        >
                          Link
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-zinc-600">
                      {row.description.slice(0, 80)}
                      {row.description.length > 80 ? "…" : ""}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={analyzingRow !== null}
                        onClick={() => handleAnalyzeRow(row)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {analyzingRow === row.rowNumber ? "Opening…" : "Analyze"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {flowStatus === "preview" ? (
              <button
                type="button"
                onClick={handleSaveAll}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Save {previewRows.length} job{previewRows.length === 1 ? "" : "s"} to library
              </button>
            ) : (
              <p className="text-xs text-emerald-800">{SPREADSHEET_IMPORT_SUCCESS_MESSAGE}</p>
            )}
            <button
              type="button"
              onClick={() => router.push("/analyze")}
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
            >
              Add a single job manually
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
