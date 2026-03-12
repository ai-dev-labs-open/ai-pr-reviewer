import { GitHubApiError } from "../errors";
import type { GitHubIssueComment, GitHubPullRequestFile } from "../types";

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly apiBaseUrl = "https://api.github.com"
  ) {}

  async listPullRequestFiles(
    owner: string,
    repo: string,
    pullRequestNumber: number
  ): Promise<GitHubPullRequestFile[]> {
    const files: GitHubPullRequestFile[] = [];

    for (let page = 1; ; page += 1) {
      const pageResult = await this.request<GitHubPullRequestFile[]>(
        `/repos/${owner}/${repo}/pulls/${pullRequestNumber}/files?per_page=100&page=${page}`
      );

      files.push(...pageResult);

      if (pageResult.length < 100) {
        return files;
      }
    }
  }

  async listIssueComments(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssueComment[]> {
    return this.request<GitHubIssueComment[]>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`
    );
  }

  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    await this.request(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      "POST",
      { body }
    );
  }

  async updateIssueComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/issues/comments/${commentId}`, "PATCH", {
      body
    });
  }

  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "user-agent": "ai-pr-reviewer"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubApiError(
        `GitHub API request failed with status ${response.status}: ${text || response.statusText}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
