import {
  readAlphaScopedStorageItem,
  removeAlphaScopedStorageItem,
  writeAlphaScopedStorageItem,
  type AlphaScopedStorageResource,
} from "@/lib/alpha-scoped-storage";
import { writeScopedJson, writeScopedPlainItem } from "@/lib/alpha-scoped-json-write";
import { clearResumeRelatedStorage } from "@/lib/alpha-storage-hygiene";
import type { ProfileData } from "@/types/coach";

export type StoredResumeInput = {
  summary: string;
  skills: string;
  highlights: string;
  education: string;
  rawText?: string;
  candidateName?: string;
  contactLine?: string;
  extraSections?: StoredResumeAdditionalSection[];
};

export type StoredResumeAdditionalSection = {
  heading: string;
  content: string;
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
  rawText?: string;
  candidateName?: string;
  contactLine?: string;
  extraSections?: StoredResumeAdditionalSection[];
  sourceFileName?: string;
  uploadedAt?: string;
  uploadFileType?: "pdf" | "docx";
  savedAt?: string | null;
  parsedAt?: string | null;
  sourceResumeId?: string;
  sourceResumeName?: string;
  tailoredForJobId?: string;
  tailoredForJobTitle?: string;
  tailoredForCompany?: string;
};

export type ResumePersistenceState = {
  activeResumeId: string | null;
  activeResumeName: string | null;
  input: StoredResumeInput;
  upload: StoredResumeUploadState | null;
  savedAt: string | null;
  parsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sourceFileName: string | null;
  isSavedForAnalysis: boolean;
  needsParseReview: boolean;
};

export const RESUME_STORAGE_CHANGED_EVENT = "career-coach:resume-storage-changed";

const EMPTY_RESUME_INPUT: StoredResumeInput = {
  summary: "",
  skills: "",
  highlights: "",
  education: "",
  rawText: "",
  candidateName: "",
  contactLine: "",
  extraSections: [],
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
    rawText: record.rawText ?? "",
    candidateName: record.candidateName ?? "",
    contactLine: record.contactLine ?? "",
    extraSections: record.extraSections ?? [],
  };
}

function sanitizeAdditionalSections(raw: unknown): StoredResumeAdditionalSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const section = entry as Partial<StoredResumeAdditionalSection>;
      const heading = typeof section.heading === "string" ? section.heading.trim() : "";
      const content = typeof section.content === "string" ? section.content.trim() : "";
      if (!heading || !content) return null;
      return { heading, content };
    })
    .filter((entry): entry is StoredResumeAdditionalSection => entry !== null);
}

export function inputToRecordFields(input: StoredResumeInput): Pick<
  StoredResumeRecord,
  "summary" | "skills" | "experience" | "education" | "rawText" | "candidateName" | "contactLine" | "extraSections"
> {
  return {
    summary: input.summary.trim(),
    skills: input.skills.trim(),
    experience: input.highlights.trim(),
    education: input.education.trim(),
    rawText: input.rawText?.trim() || undefined,
    candidateName: input.candidateName?.trim() || undefined,
    contactLine: input.contactLine?.trim() || undefined,
    extraSections: sanitizeAdditionalSections(input.extraSections),
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
    rawText:
      typeof raw.rawText === "string" && raw.rawText.trim().length > 0
        ? raw.rawText.trim()
        : undefined,
    candidateName:
      typeof raw.candidateName === "string" && raw.candidateName.trim().length > 0
        ? raw.candidateName.trim()
        : undefined,
    contactLine:
      typeof raw.contactLine === "string" && raw.contactLine.trim().length > 0
        ? raw.contactLine.trim()
        : undefined,
    extraSections: sanitizeAdditionalSections(raw.extraSections),
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
    sourceResumeId:
      typeof raw.sourceResumeId === "string" && raw.sourceResumeId.trim().length > 0
        ? raw.sourceResumeId.trim()
        : undefined,
    sourceResumeName:
      typeof raw.sourceResumeName === "string" && raw.sourceResumeName.trim().length > 0
        ? raw.sourceResumeName.trim()
        : undefined,
    tailoredForJobId:
      typeof raw.tailoredForJobId === "string" && raw.tailoredForJobId.trim().length > 0
        ? raw.tailoredForJobId.trim()
        : undefined,
    tailoredForJobTitle:
      typeof raw.tailoredForJobTitle === "string" && raw.tailoredForJobTitle.trim().length > 0
        ? raw.tailoredForJobTitle.trim()
        : undefined,
    tailoredForCompany:
      typeof raw.tailoredForCompany === "string" && raw.tailoredForCompany.trim().length > 0
        ? raw.tailoredForCompany.trim()
        : undefined,
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

function writeAllResumeRecords(records: StoredResumeRecord[]): boolean {
  if (!writeScopedJson("resumes", records)) {
    return false;
  }
  dispatchResumeStorageChanged();
  return true;
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
  const rawText = typeof legacy.rawText === "string" ? legacy.rawText : "";
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
    rawText: rawText.trim() || undefined,
    sourceFileName: uploadFileName || undefined,
    uploadedAt: uploadedAt || undefined,
    uploadFileType,
    savedAt,
    parsedAt,
  };

  if (!writeAllResumeRecords([record])) return;
  setActiveResumeId(id, { syncProfile: true });
  removeAlphaScopedStorageItem("resume");
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

  const records = readAllResumeRecords();
  const recordIds = new Set(records.map((record) => record.id));

  const fromStorage = readAlphaScopedStorageItem("active-resume-id")?.trim() ?? "";
  if (fromStorage && recordIds.has(fromStorage)) return fromStorage;
  if (fromStorage) {
    removeAlphaScopedStorageItem("active-resume-id");
  }

  const profileResumeId = readProfileActiveResumeId();
  if (profileResumeId && recordIds.has(profileResumeId)) {
    writeScopedPlainItem("active-resume-id", profileResumeId);
    return profileResumeId;
  }

  return records[0]?.id ?? null;
}

export function setActiveResumeId(
  resumeId: string,
  options?: { syncProfile?: boolean },
): void {
  if (!isBrowser()) return;
  if (!writeScopedPlainItem("active-resume-id", resumeId)) {
    return;
  }
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
  if (!writeAllResumeRecords(records)) {
    return null;
  }
  return records[index];
}

function touchActiveRecord(
  updater: (record: StoredResumeRecord) => StoredResumeRecord,
): StoredResumeRecord | null {
  const activeId = getActiveResumeId();
  if (!activeId) {
    const created = createResume();
    if (!created) return null;
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
    createdAt: record?.createdAt ?? null,
    updatedAt: record?.updatedAt ?? null,
    sourceFileName: record?.sourceFileName?.trim() || null,
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
  createdAt: string | null;
  updatedAt: string | null;
  sourceFileName: string | null;
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
    createdAt: persistence.createdAt,
    updatedAt: persistence.updatedAt,
    sourceFileName: persistence.sourceFileName,
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

export function saveResumeDraftForRecord(
  resumeId: string,
  input: StoredResumeInput,
): StoredResumeRecord | null {
  if (!isBrowser()) return null;
  return updateRecord(resumeId, (record) => ({
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

export function saveResumeInputForRecord(
  resumeId: string,
  input: StoredResumeInput,
): StoredResumeRecord | null {
  if (!isBrowser()) return null;
  return updateRecord(resumeId, (record) => ({
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

/** Save user-confirmed parsed resume to the active version with parsed/confirmed metadata. */
export function confirmParsedResumeInput(
  input: StoredResumeInput,
  options?: { fileType?: "pdf" | "docx"; parsedAt?: string },
): void {
  if (!isBrowser()) return;
  touchActiveRecord((record) => ({
    ...record,
    ...inputToRecordFields(input),
    savedAt: new Date().toISOString(),
    parsedAt: options?.parsedAt ?? record.parsedAt ?? new Date().toISOString(),
    uploadFileType: options?.fileType ?? record.uploadFileType,
  }));
  dispatchResumeStorageChanged();
}

export function clearLegacyResumeStorage(): void {
  if (!isBrowser()) return;
  removeAlphaScopedStorageItem("resume");
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
    rawText: undefined,
    candidateName: undefined,
    contactLine: undefined,
    extraSections: [],
    sourceFileName: undefined,
    uploadedAt: undefined,
    uploadFileType: undefined,
    savedAt: null,
    parsedAt: null,
  }));
}

export function createResume(name?: string): StoredResumeRecord | null {
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
    extraSections: [],
    savedAt: null,
    parsedAt: null,
  };
  if (!writeAllResumeRecords([record, ...records])) {
    return null;
  }
  setActiveResumeId(record.id);
  return record;
}

/** Create a new resume version from content without modifying an existing record. */
export function createResumeVersionFromInput(
  input: StoredResumeInput,
  options: {
    name: string;
    setActive?: boolean;
    sourceFileName?: string;
    uploadedAt?: string;
    parsedAt?: string | null;
    uploadFileType?: "pdf" | "docx";
  },
): StoredResumeRecord | null {
  migrateLegacyResumeIfNeeded();
  const records = readAllResumeRecords();
  const now = new Date().toISOString();
  const record: StoredResumeRecord = {
    id: buildResumeId(),
    name: options.name.trim() || `Resume ${records.length + 1}`,
    createdAt: now,
    updatedAt: now,
    ...inputToRecordFields(input),
    savedAt: now,
    parsedAt: options.parsedAt ?? null,
    sourceFileName: options.sourceFileName?.trim() || undefined,
    uploadedAt: options.uploadedAt?.trim() || undefined,
    uploadFileType: options.uploadFileType,
  };
  if (!writeAllResumeRecords([record, ...records])) {
    return null;
  }
  if (options.setActive !== false) {
    setActiveResumeId(record.id);
  }
  return record;
}

function buildUploadedResumeVersionName(sourceFileName?: string, existingCount = 0): string {
  const fromFile = sourceFileName?.trim().replace(/\.(pdf|docx)$/i, "").trim();
  if (fromFile) return fromFile.slice(0, 120);
  return `Resume ${existingCount + 1}`;
}

/** Save a confirmed upload as a new resume version and activate it by default. */
export function confirmUploadedResumeVersion(
  input: StoredResumeInput,
  options?: {
    name?: string;
    setActive?: boolean;
    sourceFileName?: string;
    uploadedAt?: string;
    parsedAt?: string;
    fileType?: "pdf" | "docx";
  },
): StoredResumeRecord | null {
  migrateLegacyResumeIfNeeded();
  const records = readAllResumeRecords();
  const now = new Date().toISOString();
  const record = createResumeVersionFromInput(input, {
    name:
      options?.name?.trim() ||
      buildUploadedResumeVersionName(options?.sourceFileName, records.length),
    setActive: options?.setActive,
    sourceFileName: options?.sourceFileName,
    uploadedAt: options?.uploadedAt ?? now,
    parsedAt: options?.parsedAt ?? now,
    uploadFileType: options?.fileType,
  });
  if (record) {
    dispatchResumeStorageChanged();
  }
  return record;
}

export function getTailoredResumeCountForJob(jobId: string): number {
  const trimmed = jobId.trim();
  if (!trimmed) return 0;
  return readAllResumeRecords().filter((record) => record.tailoredForJobId === trimmed).length;
}

export type CreateTailoredResumeVersionOptions = {
  name: string;
  sourceResumeId: string;
  sourceResumeName?: string;
  tailoredForJobId: string;
  tailoredForJobTitle: string;
  tailoredForCompany: string;
  sourceFileName?: string;
  uploadFileType?: "pdf" | "docx";
};

export function getLatestTailoredResumeForJob(jobId: string): StoredResumeRecord | null {
  const trimmed = jobId.trim();
  if (!trimmed) return null;

  const tailored = readAllResumeRecords().filter((record) => record.tailoredForJobId === trimmed);
  if (tailored.length === 0) return null;

  return tailored.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];
}

/** Create a job-specific tailored resume version without changing the active resume. */
export function createTailoredResumeVersion(
  input: StoredResumeInput,
  options: CreateTailoredResumeVersionOptions,
): StoredResumeRecord | null {
  migrateLegacyResumeIfNeeded();
  const records = readAllResumeRecords();
  const now = new Date().toISOString();
  const record: StoredResumeRecord = {
    id: buildResumeId(),
    name: options.name.trim() || `Resume ${records.length + 1}`,
    createdAt: now,
    updatedAt: now,
    ...inputToRecordFields(input),
    savedAt: now,
    parsedAt: null,
    sourceResumeId: options.sourceResumeId,
    sourceResumeName: options.sourceResumeName?.trim() || undefined,
    tailoredForJobId: options.tailoredForJobId,
    tailoredForJobTitle: options.tailoredForJobTitle.trim(),
    tailoredForCompany: options.tailoredForCompany.trim(),
    sourceFileName: options.sourceFileName?.trim() || undefined,
    uploadFileType: options.uploadFileType,
  };
  if (!writeAllResumeRecords([record, ...records])) {
    return null;
  }
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
  if (!writeAllResumeRecords([copy, ...records])) {
    return null;
  }
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

export function removeTailoredResumesForJobs(jobIds: string[]): number {
  const drop = new Set(jobIds.map((id) => id.trim()).filter((id) => id.length > 0));
  if (drop.size === 0) return 0;

  const records = readAllResumeRecords();
  const removeIds = new Set(
    records
      .filter((record) => record.tailoredForJobId && drop.has(record.tailoredForJobId))
      .map((record) => record.id),
  );
  if (removeIds.size === 0) return 0;

  const next = records.filter((record) => !removeIds.has(record.id));
  const activeId = getActiveResumeId();
  const wasActive = Boolean(activeId && removeIds.has(activeId));

  if (!writeAllResumeRecords(next)) {
    return 0;
  }

  for (const resumeId of removeIds) {
    clearResumeRelatedStorage(resumeId, { wasActive: resumeId === activeId });
  }

  if (wasActive) {
    const fallback = next[0]?.id;
    if (fallback) {
      setActiveResumeId(fallback);
    } else {
      writeAlphaScopedStorageItem("active-resume-id", "");
      syncProfileActiveResumeId("");
      removeAlphaScopedStorageItem("resume");
      dispatchResumeStorageChanged();
    }
  }

  return removeIds.size;
}

export function removeResume(resumeId: string): boolean {
  const records = readAllResumeRecords();
  const next = records.filter((record) => record.id !== resumeId);
  if (next.length === records.length) return false;

  const activeId = getActiveResumeId();
  const wasActive = activeId === resumeId;

  if (!writeAllResumeRecords(next)) {
    return false;
  }
  clearResumeRelatedStorage(resumeId, { wasActive });

  if (wasActive) {
    const fallback = next[0]?.id;
    if (fallback) {
      setActiveResumeId(fallback);
    } else {
      writeAlphaScopedStorageItem("active-resume-id", "");
      syncProfileActiveResumeId("");
      removeAlphaScopedStorageItem("resume");
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
