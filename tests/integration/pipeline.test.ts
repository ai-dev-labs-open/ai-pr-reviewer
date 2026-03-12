import { describe, expect, it, vi } from "vitest";

import { ProviderError } from "../../src/errors";
import { runReviewPipeline } from "../../src/pipeline";
import type {
  GitHubPullRequestFile,
  PullRequestContext,
  ProviderReviewResponse,
  ReviewerConfig
} from "../../src/types";

describe("runReviewPipeline", () => {
  const pullRequest: PullRequestContext = {
    owner: "acme",
    repo: "widgets",
    number: 12,
    title: "Fix auth and project visibility regressions",
    body: "Covers token rotation and archived projects.",
    url: "https://github.com/acme/widgets/pull/12",
    author: "octocat",
    baseRef: "main",
    headRef: "feature/review",
    headSha: "abcd",
    isFork: false
  };

  const baseConfig: ReviewerConfig = {
    provider: "anthropic",
    model: "test-model",
    providerApiKey: "provider-key",
    githubToken: "github-token",
    maxFiles: 10,
    maxPatchChars: 90,
    failOnSeverity: "none"
  };

  it("reviews chunked diffs and deduplicates repeated findings", async () => {
    const files: GitHubPullRequestFile[] = [
      {
        filename: "src/auth.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
        changes: 3,
        patch: "@@ -1 +1 @@\n-return session;\n+return rotateSession(session);\n"
      },
      {
        filename: "src/projects.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
        changes: 3,
        patch: "@@ -8 +8 @@\n-return visibleProjects;\n+return filterArchivedProjects(visibleProjects);\n"
      }
    ];
    const review = vi
      .fn((): Promise<ProviderReviewResponse> => Promise.resolve({
        content: JSON.stringify({
          summary: "unused",
          findings: []
        })
      }))
      .mockResolvedValueOnce({
        content: JSON.stringify({
          summary: "Chunk one found an auth issue.",
          findings: [
            {
              severity: "high",
              file: "src/auth.ts",
              title: "Missing authorization guard",
              explanation:
                "The refresh flow now trusts the caller without verifying project access.",
              suggested_test: "Add a 403 regression test for non-members."
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          summary: "Chunk two found a duplicate and a test gap.",
          findings: [
            {
              severity: "high",
              file: "src/auth.ts",
              title: "Missing authorization guard",
              explanation:
                "The refresh flow now trusts the caller without verifying project access.",
              suggested_test: "Add a 403 regression test for non-members."
            },
            {
              severity: "medium",
              file: "src/projects.ts",
              title: "Missing archived project coverage",
              explanation:
                "The diff changes archive visibility without adding a regression test.",
              suggested_test: "Add a route spec for archived project visibility."
            }
          ]
        })
      });

    const result = await runReviewPipeline({
      config: baseConfig,
      provider: {
        name: "mock",
        review
      },
      pullRequest,
      files
    });

    expect(result.chunks).toBe(2);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]?.severity).toBe("high");
    expect(result.findings[1]?.severity).toBe("medium");
    expect(review).toHaveBeenCalledTimes(2);
  });

  it("returns a no-reviewable-files summary without calling the provider", async () => {
    const review = vi.fn(
      (): Promise<ProviderReviewResponse> => Promise.resolve({
        content: JSON.stringify({
          summary: "unused",
          findings: []
        })
      })
    );

    const result = await runReviewPipeline({
      config: baseConfig,
      provider: {
        name: "mock",
        review
      },
      pullRequest,
      files: [
        {
          filename: "assets/logo.png",
          status: "modified",
          additions: 0,
          deletions: 0,
          changes: 0,
          patch: null
        }
      ]
    });

    expect(result.summaries).toEqual(["No reviewable diff hunks were available."]);
    expect(result.findings).toEqual([]);
    expect(review).not.toHaveBeenCalled();
  });

  it("surfaces provider failures", async () => {
    await expect(
      runReviewPipeline({
        config: baseConfig,
        provider: {
          name: "mock",
          review: vi
            .fn((): Promise<ProviderReviewResponse> => Promise.resolve({
              content: JSON.stringify({
                summary: "unused",
                findings: []
              })
            }))
            .mockRejectedValue(new ProviderError("provider unavailable"))
        },
        pullRequest,
        files: [
          {
            filename: "src/auth.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
            changes: 2,
            patch: "@@ -1 +1 @@\n-return old;\n+return next;\n"
          }
        ]
      })
    ).rejects.toThrow("provider unavailable");
  });
});
