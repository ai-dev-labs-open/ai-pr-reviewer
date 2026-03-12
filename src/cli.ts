#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { ConfigurationError } from "./errors";
import { runReviewPipeline } from "./pipeline";
import { createProvider } from "./providers";
import { renderReviewComment } from "./review/render";
import { getHighestSeverity } from "./review/severity";
import type { ReviewFixture, ReviewerConfig } from "./types";

interface CliOptions {
  help: boolean;
  fixture?: string;
  provider?: "anthropic" | "openai";
  model?: string;
  maxFiles?: number;
  maxPatchChars?: number;
  reviewInstructions?: string;
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);

  if (options.help || !options.fixture) {
    printUsage();
    return;
  }

  const provider = options.provider ?? "anthropic";
  const model = options.model;

  if (!model) {
    throw new ConfigurationError("--model is required for dry-run mode.");
  }

  const providerApiKey = process.env.PROVIDER_API_KEY?.trim();

  if (!providerApiKey) {
    throw new ConfigurationError(
      "PROVIDER_API_KEY must be set to call a provider from dry-run mode."
    );
  }

  const rawFixture = await readFile(options.fixture, "utf8");
  const fixture = JSON.parse(rawFixture) as ReviewFixture;
  const config: ReviewerConfig = {
    provider,
    model,
    providerApiKey,
    githubToken: "local-dry-run",
    maxFiles: options.maxFiles ?? 20,
    maxPatchChars: options.maxPatchChars ?? 12000,
    failOnSeverity: "none",
    reviewInstructions: options.reviewInstructions
  };
  const reviewProvider = createProvider(config);
  const result = await runReviewPipeline({
    config,
    provider: reviewProvider,
    pullRequest: fixture.pullRequest,
    files: fixture.files
  });
  const highestSeverity = getHighestSeverity(result.findings);
  const body = renderReviewComment({
    config,
    result,
    status: "passed",
    highestSeverity
  });

  process.stdout.write(`${body}\n`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--fixture":
        options.fixture = next;
        index += 1;
        break;
      case "--provider":
        if (next === "anthropic" || next === "openai") {
          options.provider = next;
        }
        index += 1;
        break;
      case "--model":
        options.model = next;
        index += 1;
        break;
      case "--max-files":
        options.maxFiles = parseOptionalPositiveInteger(next, "--max-files");
        index += 1;
        break;
      case "--max-patch-chars":
        options.maxPatchChars = parseOptionalPositiveInteger(next, "--max-patch-chars");
        index += 1;
        break;
      case "--review-instructions":
        options.reviewInstructions = next;
        index += 1;
        break;
      default:
        if (token.startsWith("--")) {
          throw new ConfigurationError(`Unknown CLI flag: ${token}`);
        }
        break;
    }
  }

  return options;
}

function parseOptionalPositiveInteger(
  value: string | undefined,
  flagName: string
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigurationError(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function printUsage(): void {
  process.stdout.write(
    [
      "Usage: pnpm dry-run --fixture <path> --provider <anthropic|openai> --model <model>",
      "",
      "Required environment:",
      "  PROVIDER_API_KEY",
      "",
      "Optional flags:",
      "  --max-files <number>",
      "  --max-patch-chars <number>",
      "  --review-instructions <text>"
    ].join("\n")
  );
}

void main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
