import { readAlphaScopedStorageItem } from "@/lib/alpha-scoped-storage";
import { writeScopedJson } from "@/lib/alpha-scoped-json-write";
import type { AnalyzeSelectedJobOutput } from "@/lib/ai";

type CachedEntry = {
  storedAt: string;
  payload: AnalyzeSelectedJobOutput;
};

type CacheState = Record<string, CachedEntry>;

const RESOURCE_KEY = "analysis-output-cache";

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

export function getAnalysisOutputCache(fingerprint: string): AnalyzeSelectedJobOutput | null {
  if (!fingerprint.trim()) return null;
  const cache = readCache();
  const entry = cache[fingerprint];
  return entry?.payload ?? null;
}

export function setAnalysisOutputCache(
  fingerprint: string,
  payload: AnalyzeSelectedJobOutput,
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

