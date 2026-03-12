import { SUPPORTED_FILE_STATUSES } from "../constants";
import type {
  GitHubPullRequestFile,
  ReviewChunk,
  ReviewableFile,
  SkippedFile
} from "../types";

export interface PreparedReviewInput {
  reviewableFiles: ReviewableFile[];
  chunks: ReviewChunk[];
  skippedFiles: SkippedFile[];
}

export function prepareReviewInput(
  files: GitHubPullRequestFile[],
  maxFiles: number,
  maxPatchChars: number
): PreparedReviewInput {
  const reviewableFiles: ReviewableFile[] = [];
  const skippedFiles: SkippedFile[] = [];

  for (const file of files) {
    if (!SUPPORTED_FILE_STATUSES.has(file.status)) {
      skippedFiles.push({
        file: file.filename,
        reason: "unsupported_status"
      });
      continue;
    }

    if (!file.patch) {
      skippedFiles.push({
        file: file.filename,
        reason: "binary_or_missing_patch"
      });
      continue;
    }

    if (file.patch.length > maxPatchChars) {
      skippedFiles.push({
        file: file.filename,
        reason: "patch_too_large"
      });
      continue;
    }

    if (reviewableFiles.length >= maxFiles) {
      skippedFiles.push({
        file: file.filename,
        reason: "file_limit"
      });
      continue;
    }

    reviewableFiles.push({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
      previousFilename: file.previous_filename
    });
  }

  return {
    reviewableFiles,
    chunks: chunkReviewableFiles(reviewableFiles, maxPatchChars),
    skippedFiles
  };
}

export function chunkReviewableFiles(
  files: ReviewableFile[],
  maxPatchChars: number
): ReviewChunk[] {
  const chunks: ReviewChunk[] = [];
  let currentFiles: ReviewableFile[] = [];
  let currentPatchChars = 0;

  for (const file of files) {
    const filePatchChars = file.patch.length;

    if (
      currentFiles.length > 0 &&
      currentPatchChars + filePatchChars > maxPatchChars
    ) {
      chunks.push({
        id: `chunk-${chunks.length + 1}`,
        files: currentFiles,
        patchChars: currentPatchChars
      });
      currentFiles = [];
      currentPatchChars = 0;
    }

    currentFiles.push(file);
    currentPatchChars += filePatchChars;
  }

  if (currentFiles.length > 0) {
    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      files: currentFiles,
      patchChars: currentPatchChars
    });
  }

  return chunks;
}
