import type { ReviewerConfig } from "../types";
import { AnthropicProvider } from "./anthropic";
import type { ReviewProvider } from "./interface";
import { OpenAiProvider } from "./openai";

export function createProvider(
  config: ReviewerConfig,
  fetchImpl: typeof fetch = fetch
): ReviewProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config.providerApiKey, fetchImpl);
    case "openai":
      return new OpenAiProvider(config.providerApiKey, fetchImpl);
    default:
      throw new Error(`Unsupported provider: ${String(config.provider)}`);
  }
}
