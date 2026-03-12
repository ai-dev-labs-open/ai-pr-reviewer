import { describe, expect, it } from "vitest";

import { mergeChunkResults, parseReviewResponse } from "../../src/review/normalize";

describe("review normalization", () => {
  it("parses fenced JSON payloads and deduplicates findings across chunks", () => {
    const chunkOne = parseReviewResponse(`\`\`\`json
{
  "summary": "Actionable issues found.",
  "findings": [
    {
      "severity": "high",
      "file": "src/auth.ts",
      "title": "Missing authorization guard",
      "explanation": "The new route trusts the caller without verifying project access.",
      "suggested_test": "Add a 403 regression test for non-members."
    }
  ]
}
\`\`\``);

    const chunkTwo = parseReviewResponse(
      JSON.stringify({
        summary: "A second chunk repeated one issue and added another.",
        findings: [
          {
            severity: "high",
            file: "src/auth.ts",
            title: "Missing authorization guard",
            explanation:
              "The new route trusts the caller without verifying project access.",
            suggestedTest: "Add a 403 regression test for non-members."
          },
          {
            severity: "medium",
            file: "src/projects.ts",
            title: "Missing archived project regression coverage",
            explanation:
              "The diff changes archive visibility but does not add tests for archived records.",
            suggestedTest: "Add a route spec for archived project visibility."
          }
        ]
      })
    );

    const merged = mergeChunkResults([chunkOne, chunkTwo]);

    expect(merged.summaries).toEqual([
      "Actionable issues found.",
      "A second chunk repeated one issue and added another."
    ]);
    expect(merged.findings).toHaveLength(2);
    expect(merged.findings[0]?.severity).toBe("high");
    expect(merged.findings[1]?.severity).toBe("medium");
  });
});
