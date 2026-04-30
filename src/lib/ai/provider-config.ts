import type { AIProviderId, ProviderConfigState } from "@/lib/ai/types";
import { getProviderConfigStore } from "@/lib/ai/provider-config-store";

const providerConfigState: ProviderConfigState = {
  activeProvider: "gemini",
  configuredProviders: {
    gemini: true,
    openai: false,
    anthropic: false,
  },
};

let hydratedFromStorage = false;

function hydrateProviderConfigFromStorage(): void {
  if (hydratedFromStorage || typeof window === "undefined") {
    return;
  }
  hydratedFromStorage = true;

  const parsed = getProviderConfigStore().load();
  if (!parsed) return;

  const parsedConfigured = parsed.configuredProviders;
  if (parsedConfigured && typeof parsedConfigured === "object") {
    for (const providerId of ["gemini", "openai", "anthropic"] as const) {
      const value = parsedConfigured[providerId];
      if (typeof value === "boolean") {
        providerConfigState.configuredProviders[providerId] = value;
      }
    }
  }
  if (
    parsed.activeProvider === "gemini" ||
    parsed.activeProvider === "openai" ||
    parsed.activeProvider === "anthropic"
  ) {
    providerConfigState.activeProvider = parsed.activeProvider;
  }
}

function persistProviderConfig(): void {
  getProviderConfigStore().save(providerConfigState);
}

export function getProviderConfig(): ProviderConfigState {
  hydrateProviderConfigFromStorage();
  return {
    activeProvider: providerConfigState.activeProvider,
    configuredProviders: { ...providerConfigState.configuredProviders },
  };
}

export function isProviderConfigured(providerId: AIProviderId): boolean {
  hydrateProviderConfigFromStorage();
  return providerConfigState.configuredProviders[providerId];
}

export function setProviderConfigured(providerId: AIProviderId, configured: boolean): void {
  hydrateProviderConfigFromStorage();
  providerConfigState.configuredProviders[providerId] = configured;
  if (!configured && providerConfigState.activeProvider === providerId) {
    if (providerConfigState.configuredProviders.gemini) {
      providerConfigState.activeProvider = "gemini";
    } else if (providerConfigState.configuredProviders.openai) {
      providerConfigState.activeProvider = "openai";
    } else if (providerConfigState.configuredProviders.anthropic) {
      providerConfigState.activeProvider = "anthropic";
    }
  }
  persistProviderConfig();
}

export function setActiveProvider(providerId: AIProviderId): boolean {
  hydrateProviderConfigFromStorage();
  if (!isProviderConfigured(providerId)) {
    return false;
  }
  providerConfigState.activeProvider = providerId;
  persistProviderConfig();
  return true;
}

export function getActiveProvider(): AIProviderId {
  hydrateProviderConfigFromStorage();
  const configured = providerConfigState.configuredProviders[providerConfigState.activeProvider];
  if (configured) {
    return providerConfigState.activeProvider;
  }
  if (providerConfigState.configuredProviders.gemini) return "gemini";
  if (providerConfigState.configuredProviders.openai) return "openai";
  if (providerConfigState.configuredProviders.anthropic) return "anthropic";
  return "gemini";
}
