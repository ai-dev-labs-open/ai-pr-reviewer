# Architecture

## Runtime Model

The action is intentionally API-only:

- Read the GitHub event payload from `GITHUB_EVENT_PATH`
- Fetch pull request files through the GitHub REST API
- Build review chunks from patch text only
- Send prompt payloads to the selected provider
- Normalize findings and update one sticky PR comment

The action never checks out repository code or executes commands from the pull request branch.

## Review Pipeline

1. Parse workflow inputs and validate provider credentials.
2. Read pull request context from the event payload.
3. Fetch changed files from the GitHub API.
4. Filter unsupported files, generated/lockfiles, and oversized patches.
5. Chunk the remaining diff text by `max-patch-chars`.
6. Build one provider-neutral prompt per chunk (includes chunk index/total for context).
7. Call the provider adapter (with timeout and bounded retries).
8. Parse and normalize JSON findings.
9. Deduplicate and severity-sort the merged findings.
10. Render and upsert the sticky PR summary comment.
11. Set workflow outputs and optionally fail on severity threshold.

## Diff Filtering

Files are skipped before review in this priority order:

1. **Unsupported status** — only `added`, `modified`, and `renamed` files are reviewed.
2. **Generated or lockfile** — matched by exact filename (e.g. `yarn.lock`) or path pattern (e.g. `*.min.js`, `dist/*.js`, `__generated__/`).
3. **Binary or missing patch** — GitHub API returned no diff text.
4. **Oversized patch** — patch length exceeds `max-patch-chars`.
5. **File limit** — file count exceeds `max-files`.

All skipped files and their reasons appear in the sticky comment.

## Network Hardening

Every outbound HTTP request (GitHub API and provider APIs) is wrapped with:

- **Timeout** — 30-second `AbortController` deadline per request.
- **Retry** — up to 2 additional attempts with exponential backoff on transient errors (HTTP 429, 500, 502, 503, 504) or network failures.

Timeout and retry logic lives in `src/network.ts` and is shared across all callers.

## Sticky Comment Lifecycle

The action posts one comment per PR and updates it on every run. A comment is considered "owned" by the action when:

1. The comment body starts with `<!-- ai-pr-reviewer:sticky-comment -->`.
2. The comment author is a GitHub Actions bot account (`user.type === "Bot"` or `user.login` ends with `[bot]`).

Both conditions must be satisfied. This prevents accidentally clobbering a comment that merely contains the marker string in its text body.

## Provider Model

Provider adapters are thin transport layers. They only:

- translate the review prompt to provider request format
- return raw JSON-like text
- surface provider-specific errors cleanly

Everything else lives in shared pipeline code so that adding a new provider does not fork review behavior.

## Dist Strategy

- Source code lives in `src/`
- Tests and fixtures live in `tests/`
- `pnpm build:action` bundles `src/index.ts` into `dist/` using `@vercel/ncc`
- The release workflow rebuilds `dist/` from the tagged source and commits it back to the tag
- Consumers reference the action at a tag and get a pre-built, deterministic artifact
