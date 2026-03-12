import { describe, expect, it } from "vitest";

import { prepareReviewInput } from "../../src/review/diff";
import type { GitHubPullRequestFile } from "../../src/types";

describe("prepareReviewInput", () => {
  it("filters unsupported files, skips oversized patches, and chunks reviewed files", () => {
    const files: GitHubPullRequestFile[] = [
      {
        filename: "src/keep-one.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
        changes: 3,
        patch: "@@ -1 +1 @@\n-foo\n+bar\n"
      },
      {
        filename: "src/remove-me.ts",
        status: "removed",
        additions: 0,
        deletions: 10,
        changes: 10,
        patch: "@@ -1,3 +0,0 @@\n-foo\n-bar\n-baz\n"
      },
      {
        filename: "src/keep-two.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
        changes: 3,
        patch: "@@ -2 +2 @@\n-baz\n+qux\n"
      },
      {
        filename: "src/too-large.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
        changes: 12,
        patch: `@@ -1 +1 @@\n-${"a".repeat(80)}\n+${"b".repeat(80)}\n`
      },
      {
        filename: "src/exceeds-limit.ts",
        status: "modified",
        additions: 1,
        deletions: 1,
        changes: 2,
        patch: "@@ -4 +4 @@\n-old\n+new\n"
      }
    ];

    const result = prepareReviewInput(files, 2, 60);

    expect(result.reviewableFiles.map((file) => file.filename)).toEqual([
      "src/keep-one.ts",
      "src/keep-two.ts"
    ]);
    expect(result.chunks).toHaveLength(1);
    expect(result.skippedFiles).toEqual([
      {
        file: "src/remove-me.ts",
        reason: "unsupported_status"
      },
      {
        file: "src/too-large.ts",
        reason: "patch_too_large"
      },
      {
        file: "src/exceeds-limit.ts",
        reason: "file_limit"
      }
    ]);
  });
});
