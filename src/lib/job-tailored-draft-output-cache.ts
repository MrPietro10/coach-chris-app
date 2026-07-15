import { readAlphaScopedStorageItem } from "@/lib/alpha-scoped-storage";
import { writeScopedJson } from "@/lib/alpha-scoped-json-write";
import type { TailoredResumeDraft } from "@/lib/tailored-resume-draft";

type CachedEntry = {
  storedAt: string;
  payload: TailoredResumeDraft;
};

type CacheState = Record<string, CachedEntry>;

const RESOURCE_KEY = "tailored-draft-output-cache";

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

function readCache(): CacheState {
  if (!isBrowser()) return {};
  const parsed = parseJson<CacheState>(readAlphaScopedStorageItem(RESOURCE_KEY));
  if (!parsed || typeof parsed !== "object") return {};
  return parsed;
}

export function getTailoredDraftOutputCache(fingerprint: string): TailoredResumeDraft | null {
  if (!fingerprint.trim()) return null;
  const cache = readCache();
  const entry = cache[fingerprint];
  return entry?.payload ?? null;
}

export function setTailoredDraftOutputCache(
  fingerprint: string,
  payload: TailoredResumeDraft,
): boolean {
  if (!isBrowser()) return false;
  const key = fingerprint.trim();
  if (!key) return false;

  const cache = readCache();
  cache[key] = { storedAt: new Date().toISOString(), payload };

  // Keep the cache bounded to avoid unbounded localStorage growth.
  const keys = Object.keys(cache);
  if (keys.length > 40) {
    keys
      .sort((a, b) => (cache[a]?.storedAt ?? "").localeCompare(cache[b]?.storedAt ?? ""))
      .slice(0, keys.length - 40)
      .forEach((k) => {
        delete cache[k];
      });
  }

  return writeScopedJson(RESOURCE_KEY, cache);
}
