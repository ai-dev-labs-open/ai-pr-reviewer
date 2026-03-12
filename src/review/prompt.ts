import type { PullRequestContext, ReviewChunk } from "../types";

export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

/** Maximum characters of PR description forwarded to the model. */
const MAX_PR_BODY_CHARS = 1500;

/**
 * Builds a prompt pair for a single review chunk.
 *
 * @param pullRequest - PR metadata from the GitHub event payload.
 * @param chunk - The diff chunk to review.
 * @param totalChunks - Total number of chunks in this PR (for context).
 * @param reviewInstructions - Optional extra instructions from the workflow input.
 */
export function buildReviewPrompt(
  pullRequest: PullRequestContext,
  chunk: ReviewChunk,
  reviewInstructions?: string,
  totalChunks = 1
): PromptPair {
  const systemPrompt = [
    "You are a senior software engineer performing pull request review.",
    "Your only job is to find real problems. Focus exclusively on:",
    "  • Correctness bugs and logic errors",
    "  • Security vulnerabilities (injection, auth bypass, information disclosure, etc.)",
    "  • Behavior regressions that could break existing functionality",
    "  • Data-loss or data-corruption risks",
    "  • Concurrency hazards (race conditions, improper locking)",
    "  • Missing or inadequate test coverage for new behavior",
    "Do NOT report style issues, naming conventions, formatting, or minor nitpicks.",
    "Do NOT speculate about files or code that are not present in the diff.",
    "If you find no real problems, return an empty findings array.",
    "Return strict JSON with this shape and nothing else:",
    '{"summary":"one sentence describing the most important finding or no issues found","findings":[{"severity":"low|medium|high|critical","file":"path/to/file","title":"short descriptive title","explanation":"clear explanation of why this is a real problem and what the impact is","suggested_test":"concrete test that would catch this problem if it were a bug"}]}'
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

  // Trim long PR descriptions so they do not crowd out the actual diff.
  const rawBody = pullRequest.body.trim();
  const prBody = rawBody
    ? rawBody.length > MAX_PR_BODY_CHARS
      ? `${rawBody.slice(0, MAX_PR_BODY_CHARS)}\n[description truncated]`
      : rawBody
    : "No pull request description was provided.";

  // Chunk context helps the model understand it may not see the full diff.
  const chunkLabel =
    totalChunks > 1 ? `Chunk ${chunk.id} of ${totalChunks}` : `Chunk ${chunk.id} of 1`;

  const userPrompt = [
    `Repository: ${pullRequest.owner}/${pullRequest.repo}`,
    `Pull request: #${pullRequest.number} - ${pullRequest.title}`,
    `Author: ${pullRequest.author}`,
    `URL: ${pullRequest.url}`,
    `Base branch: ${pullRequest.baseRef}`,
    `Head branch: ${pullRequest.headRef}`,
    `Forked pull request: ${pullRequest.isFork ? "yes" : "no"}`,
    chunkLabel,
    "",
    "Pull request description:",
    prBody,
    extraInstructions,
    "Changed files in this chunk:",
    filesSection,
    "",
    "Return valid JSON only. Do not wrap the JSON in markdown code fences."
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, userPrompt };
}
