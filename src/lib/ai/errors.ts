import type { AIProviderId } from "@/lib/ai/types";

export class ProviderNotConfiguredError extends Error {
  constructor(providerId: AIProviderId) {
    super(`Provider "${providerId}" is not configured.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderNotImplementedError extends Error {
  constructor(providerId: AIProviderId) {
    super(`Provider "${providerId}" adapter is not implemented yet.`);
    this.name = "ProviderNotImplementedError";
  }
}
