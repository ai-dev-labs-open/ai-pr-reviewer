import { describe, expect, it } from "vitest";

import { buildReviewPrompt } from "../../src/review/prompt";
import type { PullRequestContext, ReviewChunk } from "../../src/types";

describe("buildReviewPrompt", () => {
  const pullRequest: PullRequestContext = {
    owner: "acme",
    repo: "widgets",
    number: 42,
    title: "Fix token refresh rotation",
    body: "This tightens session rotation and archived project filtering.",
    url: "https://github.com/acme/widgets/pull/42",
    author: "octocat",
    baseRef: "main",
    headRef: "feature/tokens",
    headSha: "1234",
    isFork: true
  };

  const chunk: ReviewChunk = {
    id: "chunk-1",
    patchChars: 24,
    files: [
      {
        filename: "src/auth.ts",
        status: "modified",
        additions: 4,
        deletions: 1,
        changes: 5,
        patch: "@@ -1 +1 @@\n-return token;\n+return rotate(token);\n"
      }
    ]
  };

  it("includes pull request metadata, chunk metadata, and maintainer instructions", () => {
    const prompt = buildReviewPrompt(
      pullRequest,
      chunk,
      "Focus on auth regressions and missing tests."
    );

    expect(prompt.systemPrompt).toContain('"findings"');
    expect(prompt.userPrompt).toContain("Repository: acme/widgets");
    expect(prompt.userPrompt).toContain("Forked pull request: yes");
    expect(prompt.userPrompt).toContain("Focus on auth regressions and missing tests.");
    expect(prompt.userPrompt).toContain("src/auth.ts");
    expect(prompt.userPrompt).toContain("```diff");
  });

  it("shows chunk context as 'chunk-N of M' for multi-chunk PRs", () => {
    const prompt = buildReviewPrompt(pullRequest, chunk, undefined, 3);

    expect(prompt.userPrompt).toContain("Chunk chunk-1 of 3");
  });

  it("shows chunk context as 'chunk-N of 1' when there is only one chunk", () => {
    const prompt = buildReviewPrompt(pullRequest, chunk);

    expect(prompt.userPrompt).toContain("Chunk chunk-1 of 1");
  });

  it("truncates very long pull request descriptions", () => {
    const longBodyPR: PullRequestContext = {
      ...pullRequest,
      body: "x".repeat(3000)
    };

    const prompt = buildReviewPrompt(longBodyPR, chunk);

    expect(prompt.userPrompt).toContain("[description truncated]");
    // The body in the prompt should be shorter than the full 3000-char body
    expect(prompt.userPrompt.length).toBeLessThan(3000 + 2000);
  });

  it("uses a placeholder when the pull request description is empty", () => {
    const emptyBodyPR: PullRequestContext = { ...pullRequest, body: "" };

    const prompt = buildReviewPrompt(emptyBodyPR, chunk);

    expect(prompt.userPrompt).toContain("No pull request description was provided.");
  });
});
