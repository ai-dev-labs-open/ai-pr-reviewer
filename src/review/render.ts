import { STICKY_COMMENT_MARKER } from "../constants";
import type { ActionStatus, FailureSeverity, ReviewRunResult, ReviewerConfig } from "../types";

interface RenderCommentInput {
  config: ReviewerConfig;
  result: ReviewRunResult;
  status: ActionStatus;
  highestSeverity: FailureSeverity;
  errorMessage?: string;
}

export function renderReviewComment(input: RenderCommentInput): string {
  const lines: string[] = [
    STICKY_COMMENT_MARKER,
    "## AI PR Reviewer",
    "",
    `Status: ${input.status}`,
    "",
    `- Findings: ${input.result.findings.length}`,
    `- Highest severity: ${input.highestSeverity}`,
    `- Reviewed files: ${input.result.reviewedFiles}`,
    `- Skipped files: ${input.result.skippedFiles.length}`
  ];

  if (input.result.summaries.length > 0) {
    lines.push("", "### Summary", "", ...input.result.summaries.map((summary) => `- ${summary}`));
  }

  if (input.errorMessage) {
    lines.push("", "### Error", "", input.errorMessage);
  } else if (input.result.findings.length === 0) {
    lines.push(
      "",
      "### Findings",
      "",
      input.result.reviewedFiles > 0
        ? "No actionable findings in the reviewed diff."
        : "No reviewable diff hunks were available for this pull request."
    );
  } else {
    lines.push("", "### Findings", "");

    input.result.findings.forEach((finding, index) => {
      lines.push(
        `${index + 1}. **[${finding.severity}]** \`${finding.file}\` - ${finding.title}`,
        `   ${finding.explanation}`,
        `   Suggested test: ${finding.suggestedTest}`,
        ""
      );
    });

    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  if (input.result.skippedFiles.length > 0) {
    lines.push("", "### Skipped Files", "");
    input.result.skippedFiles.forEach((skippedFile) => {
      lines.push(`- \`${skippedFile.file}\`: ${formatSkippedReason(skippedFile.reason)}`);
    });
  }

  lines.push(
    "",
    `_Reviewed by ai-pr-reviewer with provider \`${input.config.provider}\` and model \`${input.config.model}\`._`
  );

  return lines.join("\n");
}

function formatSkippedReason(reason: string): string {
  switch (reason) {
    case "binary_or_missing_patch":
      return "patch is unavailable or binary";
    case "unsupported_status":
      return "file status is not reviewed in v1";
    case "file_limit":
      return "skipped because the max file limit was reached";
    case "patch_too_large":
      return "patch exceeded the configured max patch size";
    case "generated_or_lockfile":
      return "skipped: generated file or lockfile";
    default:
      return "skipped";
  }
}
