import { prepareReviewInput } from "./review/diff";
import { mergeChunkResults, parseReviewResponse } from "./review/normalize";
import { buildReviewPrompt } from "./review/prompt";
import type { ReviewProvider } from "./providers/interface";
import type {
  PullRequestContext,
  ReviewRunResult,
  ReviewerConfig,
  GitHubPullRequestFile
} from "./types";

interface RunReviewPipelineInput {
  config: ReviewerConfig;
  provider: ReviewProvider;
  pullRequest: PullRequestContext;
  files: GitHubPullRequestFile[];
}

export async function runReviewPipeline(
  input: RunReviewPipelineInput
): Promise<ReviewRunResult> {
  const prepared = prepareReviewInput(
    input.files,
    input.config.maxFiles,
    input.config.maxPatchChars
  );

  if (prepared.chunks.length === 0) {
    return {
      summaries: ["No reviewable diff hunks were available."],
      findings: [],
      skippedFiles: prepared.skippedFiles,
      rawResponses: [],
      reviewedFiles: prepared.reviewableFiles.length,
      chunks: 0
    };
  }

  const chunkResults = [];
  const rawResponses: string[] = [];

  for (const chunk of prepared.chunks) {
    const prompt = buildReviewPrompt(
      input.pullRequest,
      chunk,
      input.config.reviewInstructions,
      prepared.chunks.length
    );
    const providerResponse = await input.provider.review({
      model: input.config.model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt
    });

    rawResponses.push(providerResponse.content);
    chunkResults.push(parseReviewResponse(providerResponse.content));
  }

  const merged = mergeChunkResults(chunkResults);

  return {
    summaries: merged.summaries,
    findings: merged.findings,
    skippedFiles: prepared.skippedFiles,
    rawResponses,
    reviewedFiles: prepared.reviewableFiles.length,
    chunks: prepared.chunks.length
  };
}

export function createEmptyReviewRunResult(): ReviewRunResult {
  return {
    summaries: [],
    findings: [],
    skippedFiles: [],
    rawResponses: [],
    reviewedFiles: 0,
    chunks: 0
  };
}
