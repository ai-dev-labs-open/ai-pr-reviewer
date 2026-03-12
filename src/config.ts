import { ConfigurationError } from "./errors";
import type { FailureSeverity, ProviderName, ReviewerConfig } from "./types";

const SUPPORTED_PROVIDERS = new Set<ProviderName>(["anthropic", "openai"]);
const SUPPORTED_FAILURE_LEVELS = new Set<FailureSeverity>([
  "none",
  "low",
  "medium",
  "high",
  "critical"
]);

export function parseActionConfig(env: NodeJS.ProcessEnv = process.env): ReviewerConfig {
  const provider = readProvider(env.INPUT_PROVIDER);

  return {
    provider,
    model: readRequired(env.INPUT_MODEL, "model"),
    providerApiKey: readRequired(env.INPUT_PROVIDER_API_KEY, "provider-api-key"),
    githubToken: readRequired(env.INPUT_GITHUB_TOKEN, "github-token"),
    maxFiles: readPositiveInteger(env.INPUT_MAX_FILES, "max-files", 20),
    maxPatchChars: readPositiveInteger(
      env.INPUT_MAX_PATCH_CHARS,
      "max-patch-chars",
      12000
    ),
    failOnSeverity: readFailureSeverity(env.INPUT_FAIL_ON_SEVERITY),
    reviewInstructions: readOptional(env.INPUT_REVIEW_INSTRUCTIONS)
  };
}

function readRequired(value: string | undefined, inputName: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new ConfigurationError(`Missing required input: ${inputName}.`);
  }

  return normalized;
}

function readOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readProvider(value: string | undefined): ProviderName {
  const normalized = readRequired(value, "provider").toLowerCase() as ProviderName;

  if (!SUPPORTED_PROVIDERS.has(normalized)) {
    throw new ConfigurationError(
      `Unsupported provider "${normalized}". Supported values: anthropic, openai.`
    );
  }

  return normalized;
}

function readFailureSeverity(value: string | undefined): FailureSeverity {
  const normalized = (value?.trim().toLowerCase() ?? "none") as FailureSeverity;

  if (!SUPPORTED_FAILURE_LEVELS.has(normalized)) {
    throw new ConfigurationError(
      `Unsupported fail-on-severity "${normalized}". Supported values: none, low, medium, high, critical.`
    );
  }

  return normalized;
}

function readPositiveInteger(
  value: string | undefined,
  inputName: string,
  defaultValue: number
): number {
  const normalized = value?.trim();

  if (!normalized) {
    return defaultValue;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigurationError(`Input "${inputName}" must be a positive integer.`);
  }

  return parsed;
}
