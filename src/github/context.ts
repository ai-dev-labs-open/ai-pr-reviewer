import { readFile } from "node:fs/promises";

import { ConfigurationError } from "../errors";
import type { PullRequestContext } from "../types";

interface PullRequestEventPayload {
  repository?: {
    name?: string;
    full_name?: string;
    owner?: {
      login?: string;
    };
  };
  pull_request?: {
    number?: number;
    html_url?: string;
    title?: string;
    body?: string | null;
    user?: {
      login?: string;
    };
    base?: {
      ref?: string;
    };
    head?: {
      ref?: string;
      sha?: string;
      repo?: {
        full_name?: string;
      };
    };
  };
}

export async function readPullRequestContext(
  eventPath: string,
  repositoryOverride?: string
): Promise<PullRequestContext> {
  const rawPayload = await readFile(eventPath, "utf8");
  const payload = JSON.parse(rawPayload) as PullRequestEventPayload;
  const pullRequest = payload.pull_request;

  if (!pullRequest?.number) {
    throw new ConfigurationError("The current GitHub event does not include a pull request.");
  }

  const repositoryFullName =
    repositoryOverride?.trim() || payload.repository?.full_name?.trim() || "";
  const [owner, repo] = repositoryFullName.split("/");

  if (!owner || !repo) {
    throw new ConfigurationError("Unable to determine the owner/repository from the event.");
  }

  const baseRepositoryFullName = payload.repository?.full_name?.trim() ?? `${owner}/${repo}`;
  const headRepositoryFullName = pullRequest.head?.repo?.full_name?.trim() ?? baseRepositoryFullName;

  return {
    owner,
    repo,
    number: pullRequest.number,
    title: pullRequest.title?.trim() || "Untitled pull request",
    body: pullRequest.body?.trim() || "",
    url: pullRequest.html_url?.trim() || "",
    author: pullRequest.user?.login?.trim() || "unknown",
    baseRef: pullRequest.base?.ref?.trim() || "unknown",
    headRef: pullRequest.head?.ref?.trim() || "unknown",
    headSha: pullRequest.head?.sha?.trim() || "",
    isFork: headRepositoryFullName !== baseRepositoryFullName
  };
}
