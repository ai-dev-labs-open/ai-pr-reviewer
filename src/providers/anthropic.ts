import { ProviderError } from "../errors";
import { fetchWithRetry } from "../network";
import type { ProviderReviewRequest, ProviderReviewResponse } from "../types";
import type { ReviewProvider } from "./interface";

interface AnthropicMessageResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

export class AnthropicProvider implements ReviewProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async review(request: ProviderReviewRequest): Promise<ProviderReviewResponse> {
    const response = await fetchWithRetry(
      this.fetchImpl,
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: 1400,
          system: request.systemPrompt,
          messages: [
            {
              role: "user",
              content: request.userPrompt
            }
          ]
        })
      }
    );

    const responseJson = (await response.json()) as AnthropicMessageResponse;

    if (!response.ok) {
      throw new ProviderError(
        `Anthropic request failed with status ${response.status}: ${
          responseJson.error?.message ?? "Unknown provider error."
        }`
      );
    }

    const content = responseJson.content
      ?.filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n");

    if (!content) {
      throw new ProviderError("Anthropic response did not contain a text payload.");
    }

    return {
      content,
      usage: {
        inputTokens: responseJson.usage?.input_tokens,
        outputTokens: responseJson.usage?.output_tokens
      }
    };
  }
}
