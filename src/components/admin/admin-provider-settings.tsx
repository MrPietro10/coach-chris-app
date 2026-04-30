"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  generateCoachReply,
  getProviderConfig,
  setActiveProvider,
  setProviderConfigured,
  type AIProviderId,
  type ProviderConfigState,
} from "@/lib/ai";
import { InfoCard } from "@/components/ui/info-card";
import { PageHeader } from "@/components/ui/page-header";

const PROVIDERS: { id: AIProviderId; label: string; description: string }[] = [
  { id: "gemini", label: "Gemini", description: "Google Gemini API" },
  { id: "openai", label: "OpenAI", description: "OpenAI platform API" },
  { id: "anthropic", label: "Anthropic", description: "Claude / Messages API" },
];

export function AdminProviderSettings() {
  const [mounted, setMounted] = useState(false);
  const [providerConfig, setProviderConfigState] = useState<ProviderConfigState>(() => ({
    activeProvider: "gemini" as const,
    configuredProviders: {
      gemini: false,
      openai: false,
      anthropic: false,
    },
  }));
  const [draftKeys, setDraftKeys] = useState<Record<AIProviderId, string>>({
    gemini: "",
    openai: "",
    anthropic: "",
  });
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState<string | null>(null);

  useEffect(() => {
    setProviderConfigState(getProviderConfig());
    setMounted(true);
  }, []);

  const activeProviderId = providerConfig.activeProvider;
  const configuredCount = useMemo(() => {
    return PROVIDERS.filter((provider) => providerConfig.configuredProviders[provider.id]).length;
  }, [providerConfig]);

  const providerStatuses = useMemo(
    () =>
      PROVIDERS.map((p) => {
        const isConfigured = providerConfig.configuredProviders[p.id];
        const isActive = activeProviderId === p.id && isConfigured;
        return {
          id: p.id,
          name: p.label,
          description: p.description,
          isConfigured,
          keyStatus: isConfigured ? "masked" : "not_configured",
          isActive,
          isSelectable: isConfigured,
          draft: draftKeys[p.id],
        };
      }),
    [providerConfig, activeProviderId, draftKeys],
  );

  const refreshProviderConfig = useCallback(() => {
    setProviderConfigState(getProviderConfig());
  }, []);

  const saveKey = useCallback(
    (id: AIProviderId) => {
      const draft = draftKeys[id].trim();
      if (draft.length === 0) return;

      setProviderConfigured(id, true);
      const nextConfig = getProviderConfig();
      if (!nextConfig.configuredProviders[nextConfig.activeProvider]) {
        setActiveProvider(id);
      }
      refreshProviderConfig();

      setDraftKeys((prev) => ({ ...prev, [id]: "" }));
      setLastSavedAt(Date.now());
    },
    [draftKeys, refreshProviderConfig],
  );

  const selectActiveProvider = useCallback(
    (id: AIProviderId) => {
      const selected = setActiveProvider(id);
      if (!selected) return;
      refreshProviderConfig();
    },
    [refreshProviderConfig],
  );

  const hasAnyConfiguredProvider = configuredCount > 0;

  const activeLabel = useMemo(() => {
    const found = PROVIDERS.find((provider) => provider.id === activeProviderId);
    return found?.label ?? "None";
  }, [activeProviderId]);

  const setDraftKey = useCallback((id: AIProviderId, value: string) => {
    setDraftKeys((prev) => ({ ...prev, [id]: value }));
  }, []);

  const testProviderRouting = useCallback(async () => {
    const currentConfig = getProviderConfig();
    const currentActiveProvider = currentConfig.activeProvider;
    const activeConfigured = currentConfig.configuredProviders[currentActiveProvider];

    if (!activeConfigured) {
      setProviderTestResult("No configured active provider to test yet.");
      return;
    }

    setIsTestingProvider(true);
    setProviderTestResult(null);
    try {
      const response = await generateCoachReply({
        userMessage: "Provider routing smoke test",
        pageContext: "admin",
      });
      setProviderTestResult(
        `Success: service routed to ${response.provider.toUpperCase()} and returned a mock response.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider test error.";
      if (
        currentActiveProvider === "openai" ||
        currentActiveProvider === "anthropic"
      ) {
        setProviderTestResult(
          `Placeholder: ${currentActiveProvider.toUpperCase()} adapter is selected but not implemented yet (${message}).`,
        );
      } else {
        setProviderTestResult(`Provider test failed: ${message}`);
      }
    } finally {
      setIsTestingProvider(false);
    }
  }, []);

  const activeBadgeText = hasAnyConfiguredProvider
    ? `Active provider: ${activeLabel}`
    : "No active provider";

  const subtitle =
    "Configure AI providers for Coach Chris. Keys are mock-stored locally and only status is persisted.";

  if (!mounted) {
    return null;
  }

  return (
    <>
      <PageHeader title="Provider settings" subtitle={subtitle} />

      <InfoCard title="Overview">
        <p className="text-zinc-600">
          {configuredCount} of {PROVIDERS.length} providers are configured. Requests route through the
          active configured provider.
        </p>
        <p className="mt-2 text-xs text-zinc-500">{activeBadgeText}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {providerStatuses.map((provider) => {
            return (
              <li
                key={provider.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">{provider.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{provider.description}</p>
                  </div>
                  {provider.isActive && (
                    <span className="shrink-0 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-zinc-600">
                    {provider.isConfigured ? "Configured" : "Not configured"}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-zinc-600">
                    {provider.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </InfoCard>

      <InfoCard title="Active provider">
        <p className="text-zinc-600">
          Select the provider used by the app service layer. Providers must be configured first.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {providerStatuses.map((provider) => {
            const selected = provider.isActive;
            return (
              <button
                key={provider.id}
                type="button"
                disabled={!provider.isSelectable}
                onClick={() => selectActiveProvider(provider.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {provider.name}
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={testProviderRouting}
            disabled={isTestingProvider || !hasAnyConfiguredProvider}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isTestingProvider ? "Testing provider..." : "Test provider"}
          </button>
        </div>
        {providerTestResult && (
          <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            {providerTestResult}
          </p>
        )}
        {!hasAnyConfiguredProvider && (
          <p className="mt-2 text-xs text-zinc-500">
            Save at least one provider key before setting an active provider.
          </p>
        )}
      </InfoCard>

      <InfoCard title="API keys">
        <p className="text-zinc-600">
          Paste a key to simulate configuration. Saved values are cleared immediately and never shown
          again.
        </p>
        {lastSavedAt != null && (
          <p className="mt-2 text-xs text-zinc-500">
            Last key save (this browser session): {new Date(lastSavedAt).toLocaleTimeString()}
          </p>
        )}
        <ul className="mt-5 space-y-5">
          {providerStatuses.map((provider) => {
            const canSave = provider.draft.trim().length > 0;
            return (
              <li
                key={provider.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{provider.name}</p>
                    <p className="text-xs text-zinc-500">{provider.description}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600">
                      {provider.isConfigured ? "Configured" : "Not configured"}
                    </span>
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={() => saveKey(provider.id)}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {provider.isConfigured ? "Update key" : "Save key"}
                    </button>
                  </div>
                </div>
                <label
                  className="mt-3 block text-xs font-medium text-zinc-700"
                  htmlFor={`key-${provider.id}`}
                >
                  API key
                </label>
                <div className="relative mt-1">
                  <input
                    id={`key-${provider.id}`}
                    name={`key-${provider.id}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={
                      provider.keyStatus === "masked" ? "Configured (masked)" : "Paste key (hidden)"
                    }
                    value={provider.draft}
                    onChange={(e) => setDraftKey(provider.id, e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
                {provider.isConfigured && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Key is configured. Enter a new value and save to replace it; stored key contents
                    are intentionally hidden.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </InfoCard>
    </>
  );
}
