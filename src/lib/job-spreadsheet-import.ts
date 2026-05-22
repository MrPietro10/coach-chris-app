import Papa from "papaparse";
import * as XLSX from "xlsx";

export const EXPECTED_JOB_COLUMNS = [
  "title",
  "company",
  "location",
  "job_url",
  "description",
] as const;

export type ExpectedJobColumn = (typeof EXPECTED_JOB_COLUMNS)[number];

export type ParsedSpreadsheetJobRow = {
  rowNumber: number;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  description: string;
};

export type SpreadsheetParseResult = {
  ok: true;
  rows: ParsedSpreadsheetJobRow[];
  skippedEmptyRows: number;
  missingColumns: ExpectedJobColumn[];
  warnings: string[];
} | {
  ok: false;
  error: string;
  missingColumns?: ExpectedJobColumn[];
};

export const MAX_SPREADSHEET_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 100;

const COLUMN_ALIASES: Record<ExpectedJobColumn, string[]> = {
  title: ["title", "job title", "job_title", "role", "position"],
  company: ["company", "employer", "organization", "organisation"],
  location: ["location", "city", "office", "region"],
  job_url: ["job_url", "job url", "url", "link", "job link", "posting url"],
  description: ["description", "job description", "job_description", "desc", "details"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildHeaderIndex(headers: string[]): Partial<Record<ExpectedJobColumn, number>> {
  const normalized = headers.map(normalizeHeader);
  const index: Partial<Record<ExpectedJobColumn, number>> = {};

  for (const column of EXPECTED_JOB_COLUMNS) {
    const aliases = COLUMN_ALIASES[column];
    const matchIndex = normalized.findIndex((header) => aliases.includes(header));
    if (matchIndex >= 0) {
      index[column] = matchIndex;
    }
  }

  return index;
}

function getMissingColumns(index: Partial<Record<ExpectedJobColumn, number>>): ExpectedJobColumn[] {
  return EXPECTED_JOB_COLUMNS.filter((column) => index[column] === undefined);
}

function cellValue(row: string[], columnIndex: number | undefined): string {
  if (columnIndex === undefined) return "";
  const raw = row[columnIndex];
  return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
}

function isRowEmpty(values: string[]): boolean {
  return values.every((value) => value.length === 0);
}

function isValidJobRow(row: ParsedSpreadsheetJobRow): boolean {
  const hasIdentity = row.title.length > 0 || row.company.length > 0;
  const hasDescription = row.description.length > 0;
  return hasIdentity && hasDescription;
}

function mapRawRows(
  rawRows: string[][],
  headerRowIndex: number,
): SpreadsheetParseResult {
  const headers = rawRows[headerRowIndex] ?? [];
  if (headers.length === 0) {
    return { ok: false, error: "Spreadsheet is missing a header row." };
  }

  const headerIndex = buildHeaderIndex(headers.map((cell) => String(cell ?? "")));
  const missingColumns = getMissingColumns(headerIndex);

  if (!headerIndex.title && !headerIndex.company && !headerIndex.description) {
    return {
      ok: false,
      error: "Could not find required columns (title, company, or description).",
      missingColumns,
    };
  }

  const warnings: string[] = [];
  if (missingColumns.length > 0) {
    warnings.push(`Missing optional columns: ${missingColumns.join(", ")}.`);
  }

  const parsed: ParsedSpreadsheetJobRow[] = [];
  let skippedEmptyRows = 0;

  for (let i = headerRowIndex + 1; i < rawRows.length; i += 1) {
    if (parsed.length >= MAX_SPREADSHEET_ROWS) {
      warnings.push(`Only the first ${MAX_SPREADSHEET_ROWS} jobs were imported.`);
      break;
    }

    const row = rawRows[i] ?? [];
    const values = [
      cellValue(row, headerIndex.title),
      cellValue(row, headerIndex.company),
      cellValue(row, headerIndex.location),
      cellValue(row, headerIndex.job_url),
      cellValue(row, headerIndex.description),
    ];

    if (isRowEmpty(values)) {
      skippedEmptyRows += 1;
      continue;
    }

    const mapped: ParsedSpreadsheetJobRow = {
      rowNumber: i + 1,
      title: values[0],
      company: values[1],
      location: values[2],
      jobUrl: values[3],
      description: values[4],
    };

    if (isValidJobRow(mapped)) {
      parsed.push(mapped);
    } else {
      skippedEmptyRows += 1;
    }
  }

  if (parsed.length === 0) {
    return {
      ok: false,
      error: "No valid job rows found in this spreadsheet.",
      missingColumns,
    };
  }

  return {
    ok: true,
    rows: parsed,
    skippedEmptyRows,
    missingColumns,
    warnings,
  };
}

function findHeaderRowIndex(rawRows: string[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 5); i += 1) {
    const headers = (rawRows[i] ?? []).map((cell) => normalizeHeader(String(cell ?? "")));
    const hasJobHeader = EXPECTED_JOB_COLUMNS.some((column) =>
      COLUMN_ALIASES[column].some((alias) => headers.includes(alias)),
    );
    if (hasJobHeader) return i;
  }
  return 0;
}

export function parseSpreadsheetRows(rawRows: string[][]): SpreadsheetParseResult {
  if (rawRows.length === 0) {
    return { ok: false, error: "Spreadsheet is empty." };
  }
  const headerRowIndex = findHeaderRowIndex(rawRows);
  return mapRawRows(rawRows, headerRowIndex);
}

export function parseCsvSpreadsheet(text: string): SpreadsheetParseResult {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    return { ok: false, error: SPREADSHEET_PARSE_ERROR(parsed.errors[0]?.message) };
  }

  const rows = parsed.data
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell ?? "")));

  return parseSpreadsheetRows(rows);
}

export function parseXlsxSpreadsheet(buffer: ArrayBuffer): SpreadsheetParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { ok: false, error: "Workbook has no sheets." };
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][];

    return parseSpreadsheetRows(rows);
  } catch {
    return { ok: false, error: "Could not read this Excel file." };
  }
}

function SPREADSHEET_PARSE_ERROR(detail?: string): string {
  return detail ? `Could not parse CSV: ${detail}` : "Could not parse CSV file.";
}

export function isCsvFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".csv");
}

export function isXlsxFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

export function validateSpreadsheetFile(file: File): string | null {
  if (!isCsvFile(file.name) && !isXlsxFile(file.name)) {
    return "Upload a CSV or XLSX file.";
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  if (file.size > MAX_SPREADSHEET_FILE_BYTES) {
    return "File is too large for beta import (max 2MB).";
  }
  return null;
}

export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetParseResult> {
  const validationError = validateSpreadsheetFile(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  if (isCsvFile(file.name)) {
    const text = await file.text();
    return parseCsvSpreadsheet(text);
  }

  const buffer = await file.arrayBuffer();
  return parseXlsxSpreadsheet(buffer);
}
