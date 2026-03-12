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
4. Filter unsupported files and skip oversized patches.
5. Chunk the remaining diff text by `max-patch-chars`.
6. Build one provider-neutral prompt per chunk.
7. Call the provider adapter.
8. Parse and normalize JSON findings.
9. Deduplicate and severity-sort the merged findings.
10. Render and upsert the sticky PR summary comment.
11. Set workflow outputs and optionally fail on severity threshold.

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
- CI uploads the built `dist/` directory as an artifact so releases can publish a deterministic action bundle
