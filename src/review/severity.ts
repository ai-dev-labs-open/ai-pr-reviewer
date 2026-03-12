import type { FailureSeverity, ReviewFinding, Severity } from "../types";

const SEVERITY_ORDER: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function compareFindings(a: ReviewFinding, b: ReviewFinding): number {
  const severityDelta = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  const fileDelta = a.file.localeCompare(b.file);

  if (fileDelta !== 0) {
    return fileDelta;
  }

  return a.title.localeCompare(b.title);
}

export function getHighestSeverity(findings: ReviewFinding[]): FailureSeverity {
  if (findings.length === 0) {
    return "none";
  }

  return findings.reduce<Severity>((highest, current) => {
    return SEVERITY_ORDER[current.severity] > SEVERITY_ORDER[highest]
      ? current.severity
      : highest;
  }, "low");
}

export function shouldFailForSeverity(
  highestSeverity: FailureSeverity,
  threshold: FailureSeverity
): boolean {
  if (highestSeverity === "none" || threshold === "none") {
    return false;
  }

  return SEVERITY_ORDER[highestSeverity] >= SEVERITY_ORDER[threshold];
}

export function normalizeSeverity(value: string): Severity | undefined {
  const normalized = value.trim().toLowerCase();

  if (normalized === "critical" || normalized === "high") {
    return normalized;
  }

  if (normalized === "medium" || normalized === "med") {
    return "medium";
  }

  if (normalized === "low" || normalized === "info" || normalized === "informational") {
    return "low";
  }

  return undefined;
}
