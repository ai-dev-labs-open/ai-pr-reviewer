import { ProviderError } from "../errors";
import { fetchWithRetry } from "../network";
import type { ProviderReviewRequest, ProviderReviewResponse } from "../types";
import type { ReviewProvider } from "./interface";

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

export class OpenAiProvider implements ReviewProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async review(request: ProviderReviewRequest): Promise<ProviderReviewResponse> {
    const response = await fetchWithRetry(
      this.fetchImpl,
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: request.model,
          temperature: 0.1,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content: request.systemPrompt
            },
            {
              role: "user",
              content: request.userPrompt
            }
          ]
        })
      }
    );

    const responseJson = (await response.json()) as OpenAiChatResponse;

    if (!response.ok) {
      throw new ProviderError(
        `OpenAI request failed with status ${response.status}: ${
          responseJson.error?.message ?? "Unknown provider error."
        }`
      );
    }

    const content = responseJson.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new ProviderError("OpenAI response did not contain a completion payload.");
    }

    return {
      content,
      usage: {
        inputTokens: responseJson.usage?.prompt_tokens,
        outputTokens: responseJson.usage?.completion_tokens
      }
    };
  }
}
