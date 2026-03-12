import { STICKY_COMMENT_MARKER } from "../constants";
import type { GitHubIssueComment, PullRequestContext } from "../types";
import type { GitHubClient } from "./api";

/**
 * Returns true only when a comment was created by this action.
 *
 * Rules (both must be satisfied):
 * 1. The comment body starts with the sticky marker (ignoring leading whitespace),
 *    so an unrelated comment that merely mentions the marker string in its text body
 *    is not treated as "owned" by this action.
 * 2. The comment author is a GitHub Actions bot account (type "Bot" or login ending
 *    in "[bot]"), which prevents a human who manually posts the marker from being
 *    overwritten.
 */
export function isOwnedComment(comment: GitHubIssueComment): boolean {
  if (!comment.body.trimStart().startsWith(STICKY_COMMENT_MARKER)) {
    return false;
  }

  const login = comment.user?.login ?? "";
  const type = comment.user?.type ?? "";

  return type === "Bot" || login.endsWith("[bot]");
}

export async function upsertStickyComment(
  client: GitHubClient,
  pullRequest: PullRequestContext,
  body: string
): Promise<void> {
  const comments = await client.listIssueComments(
    pullRequest.owner,
    pullRequest.repo,
    pullRequest.number
  );
  const existingComment = comments.find(isOwnedComment);

  if (existingComment) {
    await client.updateIssueComment(
      pullRequest.owner,
      pullRequest.repo,
      existingComment.id,
      body
    );
    return;
  }

  await client.createIssueComment(
    pullRequest.owner,
    pullRequest.repo,
    pullRequest.number,
    body
  );
}
