import { describe, expect, it } from "vitest";

import { isGeneratedOrLockfile, prepareReviewInput } from "../../src/review/diff";
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

  it("skips lockfiles and generated files before patch checks", () => {
    const patch = "@@ -1 +1 @@\n-foo\n+bar\n";
    const files: GitHubPullRequestFile[] = [
      {
        filename: "package-lock.json",
        status: "modified",
        additions: 100,
        deletions: 50,
        changes: 150,
        patch
      },
      {
        filename: "yarn.lock",
        status: "modified",
        additions: 20,
        deletions: 10,
        changes: 30,
        patch
      },
      {
        filename: "pnpm-lock.yaml",
        status: "modified",
        additions: 5,
        deletions: 2,
        changes: 7,
        patch
      },
      {
        filename: "dist/bundle.min.js",
        status: "modified",
        additions: 1,
        deletions: 1,
        changes: 2,
        patch
      },
      {
        filename: "src/__generated__/schema.ts",
        status: "added",
        additions: 50,
        deletions: 0,
        changes: 50,
        patch
      },
      {
        filename: "src/real.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
        changes: 4,
        patch
      }
    ];

    const result = prepareReviewInput(files, 20, 12000);

    expect(result.reviewableFiles.map((f) => f.filename)).toEqual(["src/real.ts"]);
    expect(result.skippedFiles).toContainEqual({
      file: "package-lock.json",
      reason: "generated_or_lockfile"
    });
    expect(result.skippedFiles).toContainEqual({
      file: "yarn.lock",
      reason: "generated_or_lockfile"
    });
    expect(result.skippedFiles).toContainEqual({
      file: "pnpm-lock.yaml",
      reason: "generated_or_lockfile"
    });
    expect(result.skippedFiles).toContainEqual({
      file: "dist/bundle.min.js",
      reason: "generated_or_lockfile"
    });
    expect(result.skippedFiles).toContainEqual({
      file: "src/__generated__/schema.ts",
      reason: "generated_or_lockfile"
    });
  });
});

describe("isGeneratedOrLockfile", () => {
  it.each([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "pnpm-lock.yml",
    "npm-shrinkwrap.json",
    "Gemfile.lock",
    "Cargo.lock",
    "poetry.lock",
    "composer.lock",
    "go.sum",
    "go.work.sum",
    "Pipfile.lock",
    "mix.lock",
    "pubspec.lock",
    "bun.lockb",
    "packages.lock.json",
    "NuGet.lock.json"
  ])("detects lockfile: %s", (filename) => {
    expect(isGeneratedOrLockfile(filename)).toBe(true);
  });

  it.each([
    "src/app.min.js",
    "public/style.min.css",
    "assets/vendor.js",
    "dist/index.js",
    "dist/main.css",
    "dist/chunk.map",
    ".next/server/app.js",
    ".nuxt/dist/client/app.js",
    "build/output.js",
    "src/__generated__/types.ts",
    "lib/generated/client.ts",
    "proto/service.pb.go",
    "Model.g.cs",
    "Form.designer.cs",
    "snapshot.snap",
    "Chart.lock"
  ])("detects generated file: %s", (filename) => {
    expect(isGeneratedOrLockfile(filename)).toBe(true);
  });

  it.each([
    "src/index.ts",
    "src/auth.ts",
    "tests/unit/auth.test.ts",
    "package.json",
    "README.md",
    "src/dist-utils.ts",
    "src/generate-report.ts"
  ])("does not skip normal file: %s", (filename) => {
    expect(isGeneratedOrLockfile(filename)).toBe(false);
  });
});
