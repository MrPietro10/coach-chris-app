import {
  readAlphaScopedStorageItem,
  writeAlphaScopedStorageItem,
  type AlphaScopedStorageResource,
} from "@/lib/alpha-scoped-storage";
import type { ProfileData } from "@/types/coach";

export type StoredResumeInput = {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
};

export type StoredResumeUploadState = {
  fileName: string;
  uploadedAt: string;
  fileType?: "pdf" | "docx";
};

export type StoredResumeRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  skills: string;
  experience: string;
  education: string;
  sourceFileName?: string;
  uploadedAt?: string;
  uploadFileType?: "pdf" | "docx";
  savedAt?: string | null;
  parsedAt?: string | null;
};

export type ResumePersistenceState = {
  activeResumeId: string | null;
  activeResumeName: string | null;
  input: StoredResumeInput;
  upload: StoredResumeUploadState | null;
  savedAt: string | null;
  parsedAt: string | null;
  isSavedForAnalysis: boolean;
  needsParseReview: boolean;
};

export const RESUME_STORAGE_CHANGED_EVENT = "career-coach:resume-storage-changed";

const EMPTY_RESUME_INPUT: StoredResumeInput = {
  summary: "",
  skills: "",
  highlights: "",
  education: "",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readScopedJson<T>(resource: AlphaScopedStorageResource): T | null {
  return parseJson<T>(readAlphaScopedStorageItem(resource));
}

function writeScopedJson(resource: AlphaScopedStorageResource, value: unknown): void {
  writeAlphaScopedStorageItem(resource, JSON.stringify(value));
}

function dispatchResumeStorageChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(RESUME_STORAGE_CHANGED_EVENT));
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function buildResumeId(): string {
  return `resume_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readProfileActiveResumeId(): string {
  const parsed = readScopedJson<Partial<ProfileData>>("profile");
  return typeof parsed?.activeResumeId === "string" ? parsed.activeResumeId.trim() : "";
}

function syncProfileActiveResumeId(resumeId: string): void {
  const parsed = readScopedJson<Partial<ProfileData>>("profile");
  const profile: ProfileData = {
    fullName: typeof parsed?.fullName === "string" ? parsed.fullName : "",
    location: typeof parsed?.location === "string" ? parsed.location : "",
    workPermit: typeof parsed?.workPermit === "string" ? parsed.workPermit : "",
    languages: Array.isArray(parsed?.languages)
      ? parsed.languages.filter((item): item is string => typeof item === "string")
      : [],
    desiredIndustries: Array.isArray(parsed?.desiredIndustries)
      ? parsed.desiredIndustries.filter((item): item is string => typeof item === "string")
      : [],
    desiredRoles: Array.isArray(parsed?.desiredRoles)
      ? parsed.desiredRoles.filter((item): item is string => typeof item === "string")
      : [],
    activeResumeId: resumeId,
  };
  writeScopedJson("profile", profile);
}

export function recordToInput(record: StoredResumeRecord): StoredResumeInput {
  return {
    summary: record.summary,
    skills: record.skills,
    highlights: record.experience,
    education: record.education,
  };
}

export function inputToRecordFields(input: StoredResumeInput): Pick<
  StoredResumeRecord,
  "summary" | "skills" | "experience" | "education"
> {
  return {
    summary: input.summary.trim(),
    skills: input.skills.trim(),
    experience: input.highlights.trim(),
    education: input.education.trim(),
  };
}

function recordUploadState(record: StoredResumeRecord): StoredResumeUploadState | null {
  const fileName = record.sourceFileName?.trim() ?? "";
  const uploadedAt = record.uploadedAt?.trim() ?? "";
  if (!fileName || !uploadedAt) return null;
  return {
    fileName,
    uploadedAt,
    fileType: record.uploadFileType,
  };
}

function sanitizeRecord(raw: Partial<StoredResumeRecord>): StoredResumeRecord | null {
  if (!raw.id || typeof raw.id !== "string" || raw.id.trim().length === 0) return null;
  const now = new Date().toISOString();
  const legacyHighlights =
    typeof (raw as { highlights?: string }).highlights === "string"
      ? (raw as { highlights?: string }).highlights
      : "";
  const experience =
    typeof raw.experience === "string" && raw.experience.trim().length > 0
      ? raw.experience.trim()
      : (legacyHighlights ?? "").trim();

  return {
    id: raw.id.trim(),
    name:
      typeof raw.name === "string" && raw.name.trim().length > 0
        ? raw.name.trim()
        : "Untitled resume",
    createdAt: isIsoTimestamp(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isIsoTimestamp(raw.updatedAt) ? raw.updatedAt : now,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    skills: typeof raw.skills === "string" ? raw.skills : "",
    experience,
    education: typeof raw.education === "string" ? raw.education : "",
    sourceFileName:
      typeof raw.sourceFileName === "string" && raw.sourceFileName.trim().length > 0
        ? raw.sourceFileName.trim()
        : undefined,
    uploadedAt: isIsoTimestamp(raw.uploadedAt) ? raw.uploadedAt : undefined,
    uploadFileType:
      raw.uploadFileType === "pdf" || raw.uploadFileType === "docx"
        ? raw.uploadFileType
        : undefined,
    savedAt: isIsoTimestamp(raw.savedAt) ? raw.savedAt : raw.savedAt === null ? null : undefined,
    parsedAt: isIsoTimestamp(raw.parsedAt) ? raw.parsedAt : raw.parsedAt === null ? null : undefined,
  };
}

function readAllResumeRecords(): StoredResumeRecord[] {
  if (!isBrowser()) return [];
  const parsed = readScopedJson<Partial<StoredResumeRecord>[]>("resumes");
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => sanitizeRecord(entry))
    .filter((entry): entry is StoredResumeRecord => entry !== null);
}

function writeAllResumeRecords(records: StoredResumeRecord[]): void {
  writeScopedJson("resumes", records);
  dispatchResumeStorageChanged();
}

function readLegacyResumeRaw(): Record<string, unknown> | null {
  const parsed = readScopedJson<Record<string, unknown>>("resume");
  return parsed && typeof parsed === "object" ? parsed : null;
}

function migrateLegacyResumeIfNeeded(): void {
  if (!isBrowser()) return;
  const existing = readAllResumeRecords();
  if (existing.length > 0) return;

  const legacy = readLegacyResumeRaw();
  if (!legacy) return;

  const summary = typeof legacy.summary === "string" ? legacy.summary : "";
  const skills = typeof legacy.skills === "string" ? legacy.skills : "";
  const highlights = typeof legacy.highlights === "string" ? legacy.highlights : "";
  const education = typeof legacy.education === "string" ? legacy.education : "";
  const uploadFileName =
    typeof legacy.uploadFileName === "string" ? legacy.uploadFileName.trim() : "";
  const uploadedAt = typeof legacy.uploadedAt === "string" ? legacy.uploadedAt.trim() : "";
  const savedAt = typeof legacy.savedAt === "string" && legacy.savedAt.trim() ? legacy.savedAt : null;
  const parsedAt =
    typeof legacy.parsedAt === "string" && legacy.parsedAt.trim() ? legacy.parsedAt : null;
  const fileTypeRaw = typeof legacy.uploadFileType === "string" ? legacy.uploadFileType : "";
  const uploadFileType = fileTypeRaw === "pdf" || fileTypeRaw === "docx" ? fileTypeRaw : undefined;

  const hasContent =
    summary.trim() ||
    skills.trim() ||
    highlights.trim() ||
    education.trim() ||
    uploadFileName;

  if (!hasContent) return;

  const now = new Date().toISOString();
  const id = buildResumeId();
  const record: StoredResumeRecord = {
    id,
    name: uploadFileName || "Imported resume",
    createdAt: now,
    updatedAt: now,
    summary,
    skills,
    experience: highlights,
    education,
    sourceFileName: uploadFileName || undefined,
    uploadedAt: uploadedAt || undefined,
    uploadFileType,
    savedAt,
    parsedAt,
  };

  writeAllResumeRecords([record]);
  setActiveResumeId(id, { syncProfile: true });
}

export function getAllResumeRecords(): StoredResumeRecord[] {
  migrateLegacyResumeIfNeeded();
  return readAllResumeRecords();
}

export function getResumeRecord(resumeId: string): StoredResumeRecord | null {
  return getAllResumeRecords().find((record) => record.id === resumeId) ?? null;
}

export function getActiveResumeId(): string | null {
  migrateLegacyResumeIfNeeded();
  if (!isBrowser()) return null;

  const fromStorage = readAlphaScopedStorageItem("active-resume-id");
  if (fromStorage?.trim()) return fromStorage.trim();

  const profileResumeId = readProfileActiveResumeId();
  if (profileResumeId) return profileResumeId;

  const records = readAllResumeRecords();
  return records[0]?.id ?? null;
}

export function setActiveResumeId(
  resumeId: string,
  options?: { syncProfile?: boolean },
): void {
  if (!isBrowser()) return;
  writeAlphaScopedStorageItem("active-resume-id", resumeId);
  if (options?.syncProfile !== false) {
    syncProfileActiveResumeId(resumeId);
  }
  dispatchResumeStorageChanged();
}

export function getActiveResumeRecord(): StoredResumeRecord | null {
  const activeId = getActiveResumeId();
  if (!activeId) return null;
  return getResumeRecord(activeId);
}

function updateRecord(
  resumeId: string,
  updater: (record: StoredResumeRecord) => StoredResumeRecord,
): StoredResumeRecord | null {
  const records = readAllResumeRecords();
  const index = records.findIndex((record) => record.id === resumeId);
  if (index < 0) return null;
  const next = updater(records[index]);
  records[index] = { ...next, updatedAt: new Date().toISOString() };
  writeAllResumeRecords(records);
  return records[index];
}

function touchActiveRecord(
  updater: (record: StoredResumeRecord) => StoredResumeRecord,
): StoredResumeRecord | null {
  const activeId = getActiveResumeId();
  if (!activeId) {
    const created = createResume();
    return updateRecord(created.id, updater);
  }
  return updateRecord(activeId, updater);
}

export function getStoredResumeInput(): StoredResumeInput {
  const record = getActiveResumeRecord();
  if (!record) return { ...EMPTY_RESUME_INPUT };
  return recordToInput(record);
}

export function getStoredResumeUploadState(): StoredResumeUploadState | null {
  const record = getActiveResumeRecord();
  if (!record) return null;
  return recordUploadState(record);
}

export function getResumeSavedAt(): string | null {
  const record = getActiveResumeRecord();
  if (!record?.savedAt) return null;
  return record.savedAt;
}

export function getResumeParsedAt(): string | null {
  const record = getActiveResumeRecord();
  if (!record?.parsedAt) return null;
  return record.parsedAt;
}

export function hasStoredResumeInput(): boolean {
  const input = getStoredResumeInput();
  return (
    input.summary.trim().length > 0 ||
    input.skills.trim().length > 0 ||
    input.highlights.trim().length > 0 ||
    input.education.trim().length > 0
  );
}

export function isResumeReadyForAnalysis(): boolean {
  return hasStoredResumeInput() && Boolean(getResumeSavedAt());
}

export function getResumePersistenceState(): ResumePersistenceState {
  const record = getActiveResumeRecord();
  const input = record ? recordToInput(record) : { ...EMPTY_RESUME_INPUT };
  const upload = record ? recordUploadState(record) : null;
  const savedAt = record?.savedAt ?? null;
  const parsedAt = record?.parsedAt ?? null;
  const hasContent = hasStoredResumeInput();

  return {
    activeResumeId: record?.id ?? null,
    activeResumeName: record?.name ?? null,
    input,
    upload,
    savedAt,
    parsedAt,
    isSavedForAnalysis: Boolean(savedAt) && hasContent,
    needsParseReview: Boolean(parsedAt) && !savedAt && hasContent,
  };
}

export function getResumeWorkspaceSnapshot(draft?: StoredResumeInput): {
  stored: StoredResumeInput;
  draft: StoredResumeInput;
  upload: StoredResumeUploadState | null;
  savedAt: string | null;
  parsedAt: string | null;
  activeResumeId: string | null;
  activeResumeName: string | null;
} {
  const persistence = getResumePersistenceState();
  const stored = persistence.input;
  return {
    stored,
    draft: draft ?? stored,
    upload: persistence.upload,
    savedAt: persistence.savedAt,
    parsedAt: persistence.parsedAt,
    activeResumeId: persistence.activeResumeId,
    activeResumeName: persistence.activeResumeName,
  };
}

export function saveStoredResumeDraft(input: StoredResumeInput): void {
  if (!isBrowser()) return;
  touchActiveRecord((record) => ({
    ...record,
    ...inputToRecordFields(input),
    savedAt: record.savedAt ?? null,
    parsedAt: record.parsedAt ?? null,
  }));
}

export function saveStoredResumeInput(input: StoredResumeInput): void {
  if (!isBrowser()) return;
  touchActiveRecord((record) => ({
    ...record,
    ...inputToRecordFields(input),
    savedAt: new Date().toISOString(),
    parsedAt: record.parsedAt ?? null,
  }));
}

export function markResumeParsed(
  input: StoredResumeInput,
  options?: { fileType?: "pdf" | "docx"; parsedAt?: string },
): void {
  if (!isBrowser()) return;
  touchActiveRecord((record) => ({
    ...record,
    ...inputToRecordFields(input),
    savedAt: null,
    parsedAt: options?.parsedAt ?? new Date().toISOString(),
    uploadFileType: options?.fileType ?? record.uploadFileType,
  }));
}

export function saveStoredResumeUploadState(state: StoredResumeUploadState): void {
  if (!isBrowser()) return;
  touchActiveRecord((record) => ({
    ...record,
    sourceFileName: state.fileName.trim(),
    uploadedAt: state.uploadedAt.trim(),
    uploadFileType: state.fileType,
  }));
}

export function clearStoredResumeUploadState(): void {
  if (!isBrowser()) return;
  touchActiveRecord((record) => ({
    ...record,
    sourceFileName: undefined,
    uploadedAt: undefined,
    uploadFileType: undefined,
  }));
}

export function clearStoredResume(): void {
  if (!isBrowser()) return;
  touchActiveRecord((record) => ({
    ...record,
    summary: "",
    skills: "",
    experience: "",
    education: "",
    sourceFileName: undefined,
    uploadedAt: undefined,
    uploadFileType: undefined,
    savedAt: null,
    parsedAt: null,
  }));
}

export function createResume(name?: string): StoredResumeRecord {
  migrateLegacyResumeIfNeeded();
  const records = readAllResumeRecords();
  const now = new Date().toISOString();
  const record: StoredResumeRecord = {
    id: buildResumeId(),
    name: name?.trim() || `Resume ${records.length + 1}`,
    createdAt: now,
    updatedAt: now,
    summary: "",
    skills: "",
    experience: "",
    education: "",
    savedAt: null,
    parsedAt: null,
  };
  writeAllResumeRecords([record, ...records]);
  setActiveResumeId(record.id);
  return record;
}

export function duplicateResume(resumeId: string): StoredResumeRecord | null {
  const source = getResumeRecord(resumeId);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: StoredResumeRecord = {
    ...source,
    id: buildResumeId(),
    name: `${source.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  const records = readAllResumeRecords();
  writeAllResumeRecords([copy, ...records]);
  setActiveResumeId(copy.id);
  return copy;
}

export function renameResume(resumeId: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return Boolean(
    updateRecord(resumeId, (record) => ({
      ...record,
      name: trimmed,
    })),
  );
}

export function setActiveResume(resumeId: string): boolean {
  if (!getResumeRecord(resumeId)) return false;
  setActiveResumeId(resumeId);
  return true;
}

export function removeResume(resumeId: string): boolean {
  const records = readAllResumeRecords();
  const next = records.filter((record) => record.id !== resumeId);
  if (next.length === records.length) return false;

  writeAllResumeRecords(next);

  const activeId = getActiveResumeId();
  if (activeId === resumeId) {
    const fallback = next[0]?.id;
    if (fallback) {
      setActiveResumeId(fallback);
    } else {
      writeAlphaScopedStorageItem("active-resume-id", "");
      syncProfileActiveResumeId("");
      dispatchResumeStorageChanged();
    }
  } else {
    dispatchResumeStorageChanged();
  }
  return true;
}

export function getActiveResumeLabel(): string {
  const record = getActiveResumeRecord();
  if (!record) return "Not added";
  if (hasStoredResumeInput()) {
    return record.name;
  }
  return record.name || "Resume added";
}
