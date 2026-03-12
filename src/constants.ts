export const STICKY_COMMENT_MARKER = "<!-- ai-pr-reviewer:sticky-comment -->";

export const SUPPORTED_FILE_STATUSES = new Set(["added", "modified", "renamed"]);

/**
 * Exact filenames that are always skipped (lockfiles, generated manifests).
 */
export const SKIPPED_EXACT_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "pnpm-lock.yml",
  "npm-shrinkwrap.json",
  "Gemfile.lock",
  "Cargo.lock",
  "poetry.lock",
  "composer.lock",
  "go.sum",
  "go.work.sum",
  "Pipfile.lock",
  "bun.lockb",
  "mix.lock",
  "pubspec.lock",
  "packages.lock.json",
  "NuGet.lock.json"
]);

/**
 * Path segment or filename suffix patterns that indicate generated or minified files.
 * Tested against the full file path using RegExp.test().
 */
export const SKIPPED_FILE_PATTERNS: RegExp[] = [
  /\.min\.(js|css|mjs|cjs)$/i,
  /[-.]bundle\.(js|css|mjs|cjs)$/i,
  // Vendor files (with or without a leading path segment)
  /(^|\/)vendor\.(js|css|mjs|cjs)$/i,
  // dist/ and build/ output directories at any depth
  /(^|\/)dist\/[^/]+\.(js|css|mjs|cjs|map)$/i,
  /(^|\/)build\/[^/]+\.(js|css|map)$/i,
  // Framework build caches
  /(^|\/)\.(next|nuxt)\//i,
  // Protobuf / gRPC generated files
  /\.(pb|pb\.go|_pb2\.py|_grpc\.pb\.go|pb\.gw\.go)$/i,
  /\.generated\.(ts|js|go|py|cs|java)$/i,
  /\.g\.cs$/i,
  /\.designer\.cs$/i,
  // Generated directories
  /(^|\/)__generated__\//i,
  /(^|\/)generated\//i,
  /\.snap$/i,
  /Chart\.lock$/i
];
