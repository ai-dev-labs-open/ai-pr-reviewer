import { describe, expect, it } from "vitest";

import { buildReviewPrompt } from "../../src/review/prompt";
import type { PullRequestContext, ReviewChunk } from "../../src/types";

describe("buildReviewPrompt", () => {
  it("includes pull request metadata, chunk metadata, and maintainer instructions", () => {
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
});
