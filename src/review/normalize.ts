import { ReviewParseError } from "../errors";
import type { ChunkReviewResult, ReviewFinding } from "../types";
import { compareFindings, normalizeSeverity } from "./severity";

interface RawFinding {
  severity?: unknown;
  file?: unknown;
  title?: unknown;
  explanation?: unknown;
  suggested_test?: unknown;
  suggestedTest?: unknown;
}

interface RawReviewResponse {
  summary?: unknown;
  findings?: unknown;
}

export function parseReviewResponse(raw: string): ChunkReviewResult {
  const parsed = parseJsonPayload(raw);
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "No summary provided.";
  const findings = Array.isArray(parsed.findings)
    ? parsed.findings.map(normalizeFinding).filter(isReviewFinding)
    : [];

  return {
    summary,
    findings
  };
}

export function mergeChunkResults(results: ChunkReviewResult[]): {
  summaries: string[];
  findings: ReviewFinding[];
} {
  const uniqueSummaries = [...new Set(results.map((result) => result.summary.trim()))].filter(
    Boolean
  );
  const findingMap = new Map<string, ReviewFinding>();

  for (const finding of results.flatMap((result) => result.findings)) {
    const key = [
      finding.file.toLowerCase(),
      finding.title.toLowerCase(),
      finding.explanation.toLowerCase()
    ].join("|");

    if (!findingMap.has(key)) {
      findingMap.set(key, finding);
    }
  }

  return {
    summaries: uniqueSummaries,
    findings: [...findingMap.values()].sort(compareFindings)
  };
}

function isReviewFinding(value: ReviewFinding | undefined): value is ReviewFinding {
  return Boolean(value);
}

function parseJsonPayload(raw: string): RawReviewResponse {
  const trimmed = raw.trim();
  const directAttempt = tryParse(trimmed);

  if (directAttempt) {
    return directAttempt;
  }

  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const fencedAttempt = tryParse(withoutFences);

  if (fencedAttempt) {
    return fencedAttempt;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slicedAttempt = tryParse(trimmed.slice(firstBrace, lastBrace + 1));

    if (slicedAttempt) {
      return slicedAttempt;
    }
  }

  throw new ReviewParseError("Provider response was not valid JSON.");
}

function tryParse(raw: string): RawReviewResponse | undefined {
  try {
    return JSON.parse(raw) as RawReviewResponse;
  } catch {
    return undefined;
  }
}

function normalizeFinding(raw: RawFinding): ReviewFinding | undefined {
  if (
    typeof raw.file !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.explanation !== "string"
  ) {
    return undefined;
  }

  const severityValue =
    typeof raw.severity === "string" ? normalizeSeverity(raw.severity) : undefined;

  if (!severityValue) {
    return undefined;
  }

  const suggestedTestValue =
    typeof raw.suggested_test === "string"
      ? raw.suggested_test
      : typeof raw.suggestedTest === "string"
        ? raw.suggestedTest
        : "Add a regression test that proves the reported issue is fixed.";

  const normalized: ReviewFinding = {
    severity: severityValue,
    file: raw.file.trim(),
    title: raw.title.trim(),
    explanation: raw.explanation.trim(),
    suggestedTest: suggestedTestValue.trim()
  };

  if (!normalized.file || !normalized.title || !normalized.explanation) {
    return undefined;
  }

  return normalized;
}
