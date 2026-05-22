import {
  readAlphaScopedStorageItem,
  writeAlphaScopedStorageItem,
} from "@/lib/alpha-scoped-storage";
import { logEvent } from "@/lib/alpha-usage-logger";

export type JobImportFeedbackRating = "up" | "down";

export type JobImportFeedbackRecord = {
  rating: JobImportFeedbackRating;
  comment?: string;
  sourceUrl?: string;
  importedAt: string;
  recordedAt: string;
};

const MAX_FEEDBACK_ENTRIES = 50;

function readFeedbackLog(): JobImportFeedbackRecord[] {
  const raw = readAlphaScopedStorageItem("job-import-feedback");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is JobImportFeedbackRecord =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as JobImportFeedbackRecord).rating !== undefined &&
        typeof (entry as JobImportFeedbackRecord).importedAt === "string",
    );
  } catch {
    return [];
  }
}

export function recordJobImportFeedback(options: {
  rating: JobImportFeedbackRating;
  importedAt: string;
  comment?: string;
  sourceUrl?: string;
}): void {
  const comment = options.comment?.trim();
  const record: JobImportFeedbackRecord = {
    rating: options.rating,
    importedAt: options.importedAt,
    recordedAt: new Date().toISOString(),
    ...(comment ? { comment: comment.slice(0, 500) } : {}),
    ...(options.sourceUrl ? { sourceUrl: options.sourceUrl.slice(0, 500) } : {}),
  };

  const withoutDuplicate = readFeedbackLog().filter(
    (entry) => entry.importedAt !== options.importedAt,
  );
  const next = [record, ...withoutDuplicate].slice(0, MAX_FEEDBACK_ENTRIES);
  writeAlphaScopedStorageItem("job-import-feedback", JSON.stringify(next));

  logEvent("import_feedback", {
    rating: options.rating,
    hasComment: Boolean(comment),
    hasSourceUrl: Boolean(options.sourceUrl),
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[import_feedback] recorded", {
      rating: options.rating,
      importedAt: options.importedAt,
    });
  }
}
