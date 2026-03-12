export type ProviderName = "anthropic" | "openai";

export type Severity = "low" | "medium" | "high" | "critical";

export type FailureSeverity = Severity | "none";

export type ActionStatus = "passed" | "failed" | "errored";

export type SkippedFileReason =
  | "binary_or_missing_patch"
  | "unsupported_status"
  | "file_limit"
  | "patch_too_large"
  | "generated_or_lockfile";

export interface ReviewerConfig {
  provider: ProviderName;
  model: string;
  providerApiKey: string;
  githubToken: string;
  maxFiles: number;
  maxPatchChars: number;
  failOnSeverity: FailureSeverity;
  reviewInstructions?: string;
}

export interface PullRequestContext {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  url: string;
  author: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  isFork: boolean;
}

export interface GitHubPullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | null;
  previous_filename?: string;
}

export interface ReviewableFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  previousFilename?: string;
}

export interface SkippedFile {
  file: string;
  reason: SkippedFileReason;
}

export interface ReviewChunk {
  id: string;
  files: ReviewableFile[];
  patchChars: number;
}

export interface ReviewFinding {
  severity: Severity;
  file: string;
  title: string;
  explanation: string;
  suggestedTest: string;
}

export interface ProviderReviewRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface ProviderReviewResponse {
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ChunkReviewResult {
  summary: string;
  findings: ReviewFinding[];
}

export interface ReviewRunResult {
  summaries: string[];
  findings: ReviewFinding[];
  skippedFiles: SkippedFile[];
  rawResponses: string[];
  reviewedFiles: number;
  chunks: number;
}

export interface RenderedReview {
  status: ActionStatus;
  highestSeverity: FailureSeverity;
  findingCount: number;
  body: string;
}

export interface ReviewFixture {
  pullRequest: PullRequestContext;
  files: GitHubPullRequestFile[];
}

export interface GitHubIssueComment {
  id: number;
  body: string;
  user?: {
    login?: string;
    type?: string;
  };
}
