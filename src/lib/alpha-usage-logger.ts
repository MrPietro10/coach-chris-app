import { readAlphaScopedStorageItem, writeAlphaScopedStorageItem } from "@/lib/alpha-scoped-storage";
import {
  ADMIN_ALPHA_STORAGE_NAMESPACE,
  getActiveAlphaStorageNamespace,
} from "@/lib/alpha-session-store";
import { ADMIN_ACCESS_STORAGE_KEY } from "@/lib/admin-access-constants";

type AlphaLogEntry = {
  user: string;
  event: string;
  metadata: Record<string, unknown>;
  timestamp: string;
};

function getStoredLogs(): AlphaLogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = readAlphaScopedStorageItem("usage-logs");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AlphaLogEntry[]) : [];
  } catch {
    return [];
  }
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const blockedKeyPattern =
    /(resume|description|skills|highlights|content|text|message|prompt)/i;
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (blockedKeyPattern.test(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      safe[key] = value.filter(
        (item) =>
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean" ||
          item === null,
      );
      continue;
    }
    if (value && typeof value === "object") {
      safe[key] = "[object]";
    }
  }

  return safe;
}

export function logEvent(eventName: string, metadata: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  const activeNamespace = getActiveAlphaStorageNamespace();
  if (!activeNamespace) return;

  const user =
    window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY) === "1"
      ? ADMIN_ALPHA_STORAGE_NAMESPACE
      : activeNamespace;
  const safeMetadata = sanitizeMetadata(metadata);
  const entry: AlphaLogEntry = {
    user,
    event: eventName,
    metadata: safeMetadata,
    timestamp: new Date().toISOString(),
  };

  const nextLogs = [...getStoredLogs(), entry];
  writeAlphaScopedStorageItem("usage-logs", JSON.stringify(nextLogs));
  void fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export function exportUsageLogs(): void {
  if (typeof window === "undefined") return;
  const logs = getStoredLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alpha-usage-logs-${new Date().toISOString()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
