import {
  readAlphaScopedStorageItem,
  writeAlphaScopedStorageItem,
} from "@/lib/alpha-scoped-storage";
import { logEvent } from "@/lib/alpha-usage-logger";

export type ResumeParseFeedbackRating = "up" | "down";

export type ResumeParseFeedbackRecord = {
  rating: ResumeParseFeedbackRating;
  parsedAt: string;
  comment?: string;
  fileType?: "pdf" | "docx";
  fileName?: string;
  recordedAt: string;
};

const MAX_FEEDBACK_ENTRIES = 50;

function sanitizeFileName(fileName: string | undefined): string | undefined {
  if (!fileName) return undefined;
  const base = fileName.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base) return undefined;
  return base.slice(0, 80);
}

function readFeedbackLog(): ResumeParseFeedbackRecord[] {
  const raw = readAlphaScopedStorageItem("resume-parse-feedback");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ResumeParseFeedbackRecord =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as ResumeParseFeedbackRecord).rating !== undefined &&
        typeof (entry as ResumeParseFeedbackRecord).parsedAt === "string",
    );
  } catch {
    return [];
  }
}

export function getResumeParseFeedbackForSession(parsedAt: string | null): ResumeParseFeedbackRating | null {
  if (!parsedAt) return null;
  const match = readFeedbackLog().find((entry) => entry.parsedAt === parsedAt);
  return match?.rating ?? null;
}

export function recordResumeParseFeedback(options: {
  rating: ResumeParseFeedbackRating;
  parsedAt: string;
  comment?: string;
  fileType?: "pdf" | "docx";
  fileName?: string;
}): void {
  const comment = options.comment?.trim();
  const record: ResumeParseFeedbackRecord = {
    rating: options.rating,
    parsedAt: options.parsedAt,
    fileType: options.fileType,
    fileName: sanitizeFileName(options.fileName),
    recordedAt: new Date().toISOString(),
    ...(comment ? { comment: comment.slice(0, 500) } : {}),
  };

  const withoutDuplicate = readFeedbackLog().filter((entry) => entry.parsedAt !== options.parsedAt);
  const next = [record, ...withoutDuplicate].slice(0, MAX_FEEDBACK_ENTRIES);
  writeAlphaScopedStorageItem("resume-parse-feedback", JSON.stringify(next));

  logEvent("parsing_feedback", {
    kind: "resume_parse",
    rating: options.rating,
    fileType: options.fileType ?? null,
    hasFileName: Boolean(record.fileName),
    hasComment: Boolean(comment),
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[resume-parse-feedback] recorded", {
      rating: options.rating,
      parsedAt: options.parsedAt,
      fileType: options.fileType,
    });
  }
}
