import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError, ProviderError } from "../../src/errors";
import { runAction } from "../../src/index";

describe("runAction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reviews fork pull requests through the GitHub API and returns a failed status on threshold match", async () => {
    const eventPath = await writeJsonTempFile({
      repository: {
        full_name: "acme/widgets"
      },
      pull_request: {
        number: 42,
        html_url: "https://github.com/acme/widgets/pull/42",
        title: "Fix token refresh handling",
        body: "Rotates refresh tokens and updates archived project visibility.",
        user: {
          login: "contributor"
        },
        base: {
          ref: "main"
        },
        head: {
          ref: "feature/forked",
          sha: "abc123",
          repo: {
            full_name: "forker/widgets"
          }
        }
      }
    });
    const outputPath = await writeTempFile("");
    const createdComments: string[] = [];
    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://api.github.test/repos/acme/widgets/pulls/42/files?per_page=100&page=1") {
        return Promise.resolve(jsonResponse([
          {
            filename: "src/auth.ts",
            status: "modified",
            additions: 2,
            deletions: 1,
            changes: 3,
            patch: "@@ -1 +1 @@\n-return session;\n+return rotateSession(session);\n"
          },
          {
            filename: "assets/logo.png",
            status: "modified",
            additions: 0,
            deletions: 0,
            changes: 0,
            patch: null
          }
        ]));
      }

      if (url === "https://api.github.test/repos/acme/widgets/issues/42/comments?per_page=100") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "https://api.github.test/repos/acme/widgets/issues/42/comments") {
        createdComments.push(readCommentBody(init));
        return Promise.resolve(jsonResponse({ id: 1001 }, 201));
      }

      if (url === "https://api.anthropic.com/v1/messages") {
        return Promise.resolve(jsonResponse({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: "The diff contains one high-severity issue.",
                findings: [
                  {
                    severity: "high",
                    file: "src/auth.ts",
                    title: "Refresh token replay risk",
                    explanation:
                      "The new path returns the current refresh token without revoking the previous token.",
                    suggested_test:
                      "Add an auth integration test that reuses the previous refresh token and expects 401."
                  }
                ]
              })
            }
          ]
        }));
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const result = await runAction(
      {
        GITHUB_API_URL: "https://api.github.test",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_REPOSITORY: "acme/widgets",
        INPUT_PROVIDER: "anthropic",
        INPUT_MODEL: "test-model",
        INPUT_PROVIDER_API_KEY: "provider-key",
        INPUT_GITHUB_TOKEN: "github-token",
        INPUT_MAX_FILES: "20",
        INPUT_MAX_PATCH_CHARS: "12000",
        INPUT_FAIL_ON_SEVERITY: "high"
      },
      fetchMock as unknown as typeof fetch
    );

    const outputs = await readFile(outputPath, "utf8");

    expect(result.status).toBe("failed");
    expect(result.highestSeverity).toBe("high");
    expect(outputs).toContain("status=failed");
    expect(outputs).toContain("highest-severity=high");
    expect(createdComments[0]).toContain("Status: failed");
    expect(createdComments[0]).toContain("### Findings");
    expect(createdComments[0]).toContain("### Skipped Files");
  });

  it("skips lockfiles and generated files and reports them in the sticky comment", async () => {
    const eventPath = await writeJsonTempFile({
      repository: {
        full_name: "acme/widgets"
      },
      pull_request: {
        number: 55,
        html_url: "https://github.com/acme/widgets/pull/55",
        title: "Add feature with dependency update",
        body: "",
        user: { login: "dev" },
        base: { ref: "main" },
        head: {
          ref: "feature/deps",
          sha: "bbb222",
          repo: { full_name: "acme/widgets" }
        }
      }
    });
    const outputPath = await writeTempFile("");
    const createdComments: string[] = [];
    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://api.github.test/repos/acme/widgets/pulls/55/files?per_page=100&page=1") {
        return Promise.resolve(jsonResponse([
          {
            filename: "package-lock.json",
            status: "modified",
            additions: 50,
            deletions: 20,
            changes: 70,
            patch: "@@ -1 +1 @@\n-\"version\": \"1\"\n+\"version\": \"2\"\n"
          },
          {
            filename: "yarn.lock",
            status: "modified",
            additions: 10,
            deletions: 5,
            changes: 15,
            patch: "@@ -1 +1 @@\n-dep@1.0.0\n+dep@2.0.0\n"
          },
          {
            filename: "src/feature.ts",
            status: "added",
            additions: 5,
            deletions: 0,
            changes: 5,
            patch: "@@ -0,0 +1,5 @@\n+export function feature() {\n+  return true;\n+}\n"
          }
        ]));
      }

      if (url === "https://api.github.test/repos/acme/widgets/issues/55/comments?per_page=100") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "https://api.github.test/repos/acme/widgets/issues/55/comments") {
        createdComments.push(readCommentBody(init));
        return Promise.resolve(jsonResponse({ id: 5501 }, 201));
      }

      if (url === "https://api.anthropic.com/v1/messages") {
        return Promise.resolve(jsonResponse({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: "No issues found in the feature file.",
                findings: []
              })
            }
          ]
        }));
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const result = await runAction(
      {
        GITHUB_API_URL: "https://api.github.test",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_REPOSITORY: "acme/widgets",
        INPUT_PROVIDER: "anthropic",
        INPUT_MODEL: "test-model",
        INPUT_PROVIDER_API_KEY: "provider-key",
        INPUT_GITHUB_TOKEN: "github-token"
      },
      fetchMock as unknown as typeof fetch
    );

    expect(result.status).toBe("passed");
    expect(result.findingCount).toBe(0);
    expect(createdComments[0]).toContain("### Skipped Files");
    expect(createdComments[0]).toContain("package-lock.json");
    expect(createdComments[0]).toContain("yarn.lock");
    expect(createdComments[0]).toContain("generated file or lockfile");
  });

  it("updates an existing owned comment instead of creating a new one", async () => {
    const eventPath = await writeJsonTempFile({
      repository: { full_name: "acme/widgets" },
      pull_request: {
        number: 77,
        html_url: "https://github.com/acme/widgets/pull/77",
        title: "Second run",
        body: "",
        user: { login: "dev" },
        base: { ref: "main" },
        head: {
          ref: "feature/second",
          sha: "ccc333",
          repo: { full_name: "acme/widgets" }
        }
      }
    });
    const outputPath = await writeTempFile("");
    const updatedComments: Array<{ id: number; body: string }> = [];
    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://api.github.test/repos/acme/widgets/pulls/77/files?per_page=100&page=1") {
        return Promise.resolve(jsonResponse([
          {
            filename: "src/app.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
            changes: 2,
            patch: "@@ -1 +1 @@\n-old\n+new\n"
          }
        ]));
      }

      // Return an existing owned comment (bot user, starts with marker)
      if (url === "https://api.github.test/repos/acme/widgets/issues/77/comments?per_page=100") {
        return Promise.resolve(jsonResponse([
          {
            id: 9900,
            body: "<!-- ai-pr-reviewer:sticky-comment -->\n## AI PR Reviewer\n\nStatus: passed\n",
            user: { login: "github-actions[bot]", type: "Bot" }
          }
        ]));
      }

      if (url === "https://api.github.test/repos/acme/widgets/issues/comments/9900") {
        updatedComments.push({ id: 9900, body: readCommentBody(init) });
        return Promise.resolve(jsonResponse({ id: 9900 }, 200));
      }

      if (url === "https://api.anthropic.com/v1/messages") {
        return Promise.resolve(jsonResponse({
          content: [
            {
              type: "text",
              text: JSON.stringify({ summary: "Clean diff.", findings: [] })
            }
          ]
        }));
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    await runAction(
      {
        GITHUB_API_URL: "https://api.github.test",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_REPOSITORY: "acme/widgets",
        INPUT_PROVIDER: "anthropic",
        INPUT_MODEL: "test-model",
        INPUT_PROVIDER_API_KEY: "provider-key",
        INPUT_GITHUB_TOKEN: "github-token"
      },
      fetchMock as unknown as typeof fetch
    );

    expect(updatedComments).toHaveLength(1);
    expect(updatedComments[0]?.id).toBe(9900);
    expect(updatedComments[0]?.body).toContain("<!-- ai-pr-reviewer:sticky-comment -->");
  });

  it("fails clearly when required secrets are missing", async () => {
    const outputPath = await writeTempFile("");

    await expect(
      runAction({
        GITHUB_OUTPUT: outputPath,
        INPUT_PROVIDER: "anthropic",
        INPUT_MODEL: "test-model",
        INPUT_GITHUB_TOKEN: "github-token"
      })
    ).rejects.toBeInstanceOf(ConfigurationError);

    const outputs = await readFile(outputPath, "utf8");
    expect(outputs).toContain("status=errored");
    expect(outputs).toContain("finding-count=0");
  });

  it("posts an error sticky comment when the provider call fails with a non-retryable error", async () => {
    const eventPath = await writeJsonTempFile({
      repository: {
        full_name: "acme/widgets"
      },
      pull_request: {
        number: 99,
        html_url: "https://github.com/acme/widgets/pull/99",
        title: "Handle provider outage",
        body: "",
        user: {
          login: "octocat"
        },
        base: {
          ref: "main"
        },
        head: {
          ref: "feature/outage",
          sha: "def456",
          repo: {
            full_name: "acme/widgets"
          }
        }
      }
    });
    const outputPath = await writeTempFile("");
    const createdComments: string[] = [];
    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://api.github.test/repos/acme/widgets/pulls/99/files?per_page=100&page=1") {
        return Promise.resolve(jsonResponse([
          {
            filename: "src/retry.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
            changes: 2,
            patch: "@@ -1 +1 @@\n-return retry(false);\n+return retry(true);\n"
          }
        ]));
      }

      if (url === "https://api.github.test/repos/acme/widgets/issues/99/comments?per_page=100") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "https://api.github.test/repos/acme/widgets/issues/99/comments") {
        createdComments.push(readCommentBody(init));
        return Promise.resolve(jsonResponse({ id: 2002 }, 201));
      }

      if (url === "https://api.anthropic.com/v1/messages") {
        // Use 401 (unauthorized) — not a retryable status code — to avoid real delays
        return Promise.resolve(jsonResponse(
          {
            error: {
              message: "provider unavailable"
            }
          },
          401
        ));
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    await expect(
      runAction(
        {
          GITHUB_API_URL: "https://api.github.test",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_OUTPUT: outputPath,
          GITHUB_REPOSITORY: "acme/widgets",
          INPUT_PROVIDER: "anthropic",
          INPUT_MODEL: "test-model",
          INPUT_PROVIDER_API_KEY: "provider-key",
          INPUT_GITHUB_TOKEN: "github-token"
        },
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toBeInstanceOf(ProviderError);

    const outputs = await readFile(outputPath, "utf8");
    expect(outputs).toContain("status=errored");
    expect(createdComments[0]).toContain("### Error");
    expect(createdComments[0]).toContain("provider unavailable");
  });
});

async function writeJsonTempFile(payload: unknown): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ai-pr-reviewer-"));
  const filePath = path.join(directory, "event.json");

  await writeFile(filePath, JSON.stringify(payload), "utf8");

  return filePath;
}

async function writeTempFile(contents: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ai-pr-reviewer-"));
  const filePath = path.join(directory, "output.txt");

  await writeFile(filePath, contents, "utf8");

  return filePath;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function readCommentBody(init?: RequestInit): string {
  const rawBody = init?.body;

  if (typeof rawBody !== "string") {
    return "";
  }

  return (JSON.parse(rawBody) as { body?: string }).body ?? "";
}
