import { appendFile } from "node:fs/promises";

import { parseActionConfig } from "./config";
import { readPullRequestContext } from "./github/context";
import { GitHubClient } from "./github/api";
import { upsertStickyComment } from "./github/sticky-comment";
import { createEmptyReviewRunResult, runReviewPipeline } from "./pipeline";
import { createProvider } from "./providers";
import { renderReviewComment } from "./review/render";
import { getHighestSeverity, shouldFailForSeverity } from "./review/severity";
import type {
  ActionStatus,
  FailureSeverity,
  PullRequestContext,
  ReviewerConfig
} from "./types";

export async function runAction(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<{
  status: ActionStatus;
  highestSeverity: FailureSeverity;
  findingCount: number;
}> {
  let result = createEmptyReviewRunResult();
  let status: ActionStatus = "passed";
  let highestSeverity: FailureSeverity = "none";
  let config: ReviewerConfig | undefined;
  let pullRequest: PullRequestContext | undefined;
  let client: GitHubClient | undefined;

  try {
    config = parseActionConfig(env);

    const eventPath = env.GITHUB_EVENT_PATH?.trim();

    if (!eventPath) {
      throw new Error("GITHUB_EVENT_PATH is required for the action runtime.");
    }

    pullRequest = await readPullRequestContext(eventPath, env.GITHUB_REPOSITORY);
    client = new GitHubClient(config.githubToken, fetchImpl, env.GITHUB_API_URL);

    const files = await client.listPullRequestFiles(
      pullRequest.owner,
      pullRequest.repo,
      pullRequest.number
    );
    const provider = createProvider(config, fetchImpl);

    result = await runReviewPipeline({
      config,
      provider,
      pullRequest,
      files
    });

    highestSeverity = getHighestSeverity(result.findings);
    status = shouldFailForSeverity(highestSeverity, config.failOnSeverity)
      ? "failed"
      : "passed";

    const body = renderReviewComment({
      config,
      result,
      status,
      highestSeverity
    });

    await upsertStickyComment(client, pullRequest, body);
    await writeOutputs(env, status, highestSeverity, result.findings.length);

    return {
      status,
      highestSeverity,
      findingCount: result.findings.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await writeOutputs(env, "errored", highestSeverity, result.findings.length);

    if (config && pullRequest && client) {
      const body = renderReviewComment({
        config,
        result,
        status: "errored",
        highestSeverity,
        errorMessage
      });

      try {
        await upsertStickyComment(client, pullRequest, body);
      } catch (commentError) {
        console.error("Failed to update sticky comment:", commentError);
      }
    }

    throw error;
  }
}

async function writeOutputs(
  env: NodeJS.ProcessEnv,
  status: ActionStatus,
  highestSeverity: FailureSeverity,
  findingCount: number
): Promise<void> {
  const outputPath = env.GITHUB_OUTPUT?.trim();

  if (!outputPath) {
    return;
  }

  const lines = [
    `status=${status}`,
    `highest-severity=${highestSeverity}`,
    `finding-count=${findingCount}`
  ];

  await appendFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

if (require.main === module) {
  void (async () => {
    try {
      const actionResult = await runAction();

      if (actionResult.status === "failed") {
        console.error(
          `Review found ${actionResult.highestSeverity} severity issues that met the configured failure threshold.`
        );
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  })();
}
