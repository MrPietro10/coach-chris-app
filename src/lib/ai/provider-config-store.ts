import type { ProviderConfigState } from "@/lib/ai/types";

export interface ProviderConfigStore {
  load(): Partial<ProviderConfigState> | null;
  save(state: ProviderConfigState): void;
}

const PROVIDER_CONFIG_STORAGE_KEY = "career-coach.ai-provider-config";

export class LocalProviderConfigStore implements ProviderConfigStore {
  load(): Partial<ProviderConfigState> | null {
    if (typeof window === "undefined") return null;

    const raw = window.localStorage.getItem(PROVIDER_CONFIG_STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Partial<ProviderConfigState>;
    } catch {
      return null;
    }
  }

  save(state: ProviderConfigState): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROVIDER_CONFIG_STORAGE_KEY, JSON.stringify(state));
  }
}

let currentStore: ProviderConfigStore = new LocalProviderConfigStore();

export function getProviderConfigStore(): ProviderConfigStore {
  return currentStore;
}

export function setProviderConfigStore(store: ProviderConfigStore): void {
  currentStore = store;
}
