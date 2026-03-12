import { describe, expect, it, vi } from "vitest";

import { STICKY_COMMENT_MARKER } from "../../src/constants";
import { isOwnedComment, upsertStickyComment } from "../../src/github/sticky-comment";
import type { GitHubIssueComment } from "../../src/types";

describe("isOwnedComment", () => {
  it("returns true for a bot comment that starts with the marker", () => {
    const comment: GitHubIssueComment = {
      id: 1,
      body: `${STICKY_COMMENT_MARKER}\n## AI PR Reviewer\n`,
      user: { login: "github-actions[bot]", type: "Bot" }
    };

    expect(isOwnedComment(comment)).toBe(true);
  });

  it("returns true when user.type is Bot even without [bot] in the login", () => {
    const comment: GitHubIssueComment = {
      id: 2,
      body: `${STICKY_COMMENT_MARKER}\ncontent`,
      user: { login: "some-app", type: "Bot" }
    };

    expect(isOwnedComment(comment)).toBe(true);
  });

  it("returns true when login ends with [bot] regardless of type", () => {
    const comment: GitHubIssueComment = {
      id: 3,
      body: `${STICKY_COMMENT_MARKER}\ncontent`,
      user: { login: "custom-app[bot]", type: "User" }
    };

    expect(isOwnedComment(comment)).toBe(true);
  });

  it("returns false for a human comment that starts with the marker", () => {
    const comment: GitHubIssueComment = {
      id: 4,
      body: `${STICKY_COMMENT_MARKER}\nI copied this marker manually`,
      user: { login: "octocat", type: "User" }
    };

    expect(isOwnedComment(comment)).toBe(false);
  });

  it("returns false for a bot comment that only contains the marker in the middle", () => {
    const comment: GitHubIssueComment = {
      id: 5,
      body: `Here is the marker: ${STICKY_COMMENT_MARKER} embedded in text`,
      user: { login: "github-actions[bot]", type: "Bot" }
    };

    expect(isOwnedComment(comment)).toBe(false);
  });

  it("returns false for a comment with no user info", () => {
    const comment: GitHubIssueComment = {
      id: 6,
      body: `${STICKY_COMMENT_MARKER}\ncontent`
    };

    expect(isOwnedComment(comment)).toBe(false);
  });

  it("ignores leading whitespace before the marker", () => {
    const comment: GitHubIssueComment = {
      id: 7,
      body: `  \n${STICKY_COMMENT_MARKER}\ncontent`,
      user: { login: "github-actions[bot]", type: "Bot" }
    };

    expect(isOwnedComment(comment)).toBe(true);
  });
});

describe("upsertStickyComment", () => {
  const pullRequest = {
    owner: "acme",
    repo: "widgets",
    number: 10,
    title: "Test PR",
    body: "",
    url: "https://github.com/acme/widgets/pull/10",
    author: "octocat",
    baseRef: "main",
    headRef: "feature/test",
    headSha: "abc123",
    isFork: false
  };

  it("creates a new comment when no owned comment exists", async () => {
    const humanComment: GitHubIssueComment = {
      id: 99,
      body: `Someone mentioned ${STICKY_COMMENT_MARKER} in their comment`,
      user: { login: "octocat", type: "User" }
    };

    const createdBodies: string[] = [];
    const client = {
      listIssueComments: vi.fn().mockResolvedValue([humanComment]),
      createIssueComment: vi.fn((_owner: string, _repo: string, _num: number, body: string) => {
        createdBodies.push(body);
        return Promise.resolve();
      }),
      updateIssueComment: vi.fn()
    };

    await upsertStickyComment(client as never, pullRequest, "new body");

    expect(client.createIssueComment).toHaveBeenCalledOnce();
    expect(client.updateIssueComment).not.toHaveBeenCalled();
    expect(createdBodies[0]).toBe("new body");
  });

  it("updates the existing owned comment and does not create a new one", async () => {
    const ownedComment: GitHubIssueComment = {
      id: 42,
      body: `${STICKY_COMMENT_MARKER}\nold content`,
      user: { login: "github-actions[bot]", type: "Bot" }
    };

    const updatedBodies: string[] = [];
    const client = {
      listIssueComments: vi.fn().mockResolvedValue([ownedComment]),
      createIssueComment: vi.fn(),
      updateIssueComment: vi.fn(
        (_owner: string, _repo: string, _id: number, body: string) => {
          updatedBodies.push(body);
          return Promise.resolve();
        }
      )
    };

    await upsertStickyComment(client as never, pullRequest, "updated body");

    expect(client.updateIssueComment).toHaveBeenCalledOnce();
    expect(client.updateIssueComment).toHaveBeenCalledWith(
      "acme",
      "widgets",
      42,
      "updated body"
    );
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });

  it("picks the first owned comment when multiple owned comments exist", async () => {
    const first: GitHubIssueComment = {
      id: 1,
      body: `${STICKY_COMMENT_MARKER}\nfirst`,
      user: { login: "github-actions[bot]", type: "Bot" }
    };
    const second: GitHubIssueComment = {
      id: 2,
      body: `${STICKY_COMMENT_MARKER}\nsecond`,
      user: { login: "github-actions[bot]", type: "Bot" }
    };

    const client = {
      listIssueComments: vi.fn().mockResolvedValue([first, second]),
      createIssueComment: vi.fn(),
      updateIssueComment: vi.fn().mockResolvedValue(undefined)
    };

    await upsertStickyComment(client as never, pullRequest, "new body");

    expect(client.updateIssueComment).toHaveBeenCalledWith("acme", "widgets", 1, "new body");
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });
});
