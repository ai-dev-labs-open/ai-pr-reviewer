import { describe, expect, it } from "vitest";

import { renderReviewComment } from "../../src/review/render";
import type { ReviewRunResult, ReviewerConfig } from "../../src/types";

describe("renderReviewComment", () => {
  it("renders sticky comment metadata, findings, and skipped files", () => {
    const config: ReviewerConfig = {
      provider: "anthropic",
      model: "test-model",
      providerApiKey: "unused",
      githubToken: "unused",
      maxFiles: 20,
      maxPatchChars: 12000,
      failOnSeverity: "high"
    };
    const result: ReviewRunResult = {
      summaries: ["Actionable issues found."],
      findings: [
        {
          severity: "high",
          file: "src/auth.ts",
          title: "Missing authorization guard",
          explanation: "The route trusts the caller without verifying project access.",
          suggestedTest: "Add a request spec that expects 403 for non-members."
        }
      ],
      skippedFiles: [
        {
          file: "assets/logo.png",
          reason: "binary_or_missing_patch"
        }
      ],
      rawResponses: [],
      reviewedFiles: 1,
      chunks: 1
    };

    const rendered = renderReviewComment({
      config,
      result,
      status: "failed",
      highestSeverity: "high"
    });

    expect(rendered).toContain("<!-- ai-pr-reviewer:sticky-comment -->");
    expect(rendered).toContain("Status: failed");
    expect(rendered).toContain("### Findings");
    expect(rendered).toContain("### Skipped Files");
    expect(rendered).toContain("assets/logo.png");
  });
});
