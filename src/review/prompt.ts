import type { PullRequestContext, ReviewChunk } from "../types";

export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

export function buildReviewPrompt(
  pullRequest: PullRequestContext,
  chunk: ReviewChunk,
  reviewInstructions?: string
): PromptPair {
  const systemPrompt = [
    "You are a senior software engineer performing pull request review.",
    "Focus on correctness bugs, security issues, behavior regressions, data-loss risks, concurrency hazards, and missing tests.",
    "Ignore style-only feedback unless it directly causes a defect.",
    "Review only the provided diff. Do not speculate about files or code that are not present in the patch.",
    "Return strict JSON with this shape and nothing else:",
    '{"summary":"one sentence","findings":[{"severity":"low|medium|high|critical","file":"path/to/file","title":"short finding title","explanation":"why this matters","suggested_test":"specific test to add"}]}'
  ].join("\n");

  const filesSection = chunk.files
    .map((file) => {
      const renameLine = file.previousFilename
        ? `Previous filename: ${file.previousFilename}\n`
        : "";

      return [
        `### ${file.filename}`,
        `Status: ${file.status}; additions: ${file.additions}; deletions: ${file.deletions}; changes: ${file.changes}`,
        renameLine + "```diff",
        file.patch,
        "```"
      ].join("\n");
    })
    .join("\n\n");

  const extraInstructions = reviewInstructions
    ? `\nAdditional maintainer instructions:\n${reviewInstructions}\n`
    : "";

  const prBody = pullRequest.body.trim() || "No pull request description was provided.";

  const userPrompt = [
    `Repository: ${pullRequest.owner}/${pullRequest.repo}`,
    `Pull request: #${pullRequest.number} - ${pullRequest.title}`,
    `Author: ${pullRequest.author}`,
    `URL: ${pullRequest.url}`,
    `Base branch: ${pullRequest.baseRef}`,
    `Head branch: ${pullRequest.headRef}`,
    `Forked pull request: ${pullRequest.isFork ? "yes" : "no"}`,
    `Chunk: ${chunk.id}`,
    "",
    "Pull request description:",
    prBody,
    extraInstructions,
    "Changed files in this chunk:",
    filesSection,
    "",
    "Return valid JSON only."
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, userPrompt };
}
