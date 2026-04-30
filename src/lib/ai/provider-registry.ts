import { ProviderNotConfiguredError } from "@/lib/ai/errors";
import { getActiveProvider, isProviderConfigured } from "@/lib/ai/provider-config";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic-provider";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import type { AIProvider, AIProviderId, ProviderConfigState } from "@/lib/ai/types";

const providers: Record<AIProviderId, AIProvider> = {
  gemini: new GeminiProvider(),
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
};

export function getProviderById(providerId: AIProviderId): AIProvider {
  return providers[providerId];
}

function pickConfiguredProvider(
  configured: Record<AIProviderId, boolean>,
  preferred: AIProviderId,
): AIProviderId | null {
  if (configured[preferred]) return preferred;
  if (configured.gemini) return "gemini";
  if (configured.openai) return "openai";
  if (configured.anthropic) return "anthropic";
  return null;
}

export function getRoutedProvider(providerConfig?: ProviderConfigState): AIProvider {
  if (providerConfig) {
    const providerId = pickConfiguredProvider(
      providerConfig.configuredProviders,
      providerConfig.activeProvider,
    );
    if (!providerId) {
      throw new ProviderNotConfiguredError(providerConfig.activeProvider);
    }
    return providers[providerId];
  }

  const activeProvider = getActiveProvider();
  if (!isProviderConfigured(activeProvider)) {
    throw new ProviderNotConfiguredError(activeProvider);
  }
  const providerId = pickConfiguredProvider(
    {
      gemini: isProviderConfigured("gemini"),
      openai: isProviderConfigured("openai"),
      anthropic: isProviderConfigured("anthropic"),
    },
    activeProvider,
  );
  if (!providerId) {
    throw new ProviderNotConfiguredError(activeProvider);
  }
  return providers[providerId];
}
