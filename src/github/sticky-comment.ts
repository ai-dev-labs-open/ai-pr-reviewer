import { STICKY_COMMENT_MARKER } from "../constants";
import type { PullRequestContext } from "../types";
import type { GitHubClient } from "./api";

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
  const existingComment = comments.find((comment) =>
    comment.body.includes(STICKY_COMMENT_MARKER)
  );

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
