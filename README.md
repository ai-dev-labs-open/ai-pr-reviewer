# AI PR Reviewer

`ai-pr-reviewer` is a secure GitHub Action that reviews pull request diffs with Anthropic or OpenAI and posts one sticky summary comment back to the PR.

It is built for public repositories, forked pull requests, and automated review workflows where running untrusted PR code is not acceptable. The action never checks out or executes the pull request branch. It only reads pull request metadata and changed-file patches through the GitHub API.

## Why This Exists

- Keep PR review focused on bugs, regressions, security risks, and missing tests.
- Support multiple model providers without changing the review pipeline.
- Preserve a low-noise workflow by updating one sticky comment instead of scattering inline comments.
- Keep local development straightforward with a fixture-driven dry-run command.

## Features

- GitHub Action designed around `pull_request_target` for safe forked-PR review
- Anthropic and OpenAI provider adapters behind one interface
- Automatic skipping of generated files, minified assets, and lockfiles
- Diff filtering, chunking, normalization, deduplication, and severity ranking
- Sticky PR summary comment with outputs for downstream workflow gating
- Network timeouts and bounded retries on all outbound requests
- Local dry-run mode for reviewing saved fixtures without GitHub events

## Quick Start

### 1. Add the workflow

Create `.github/workflows/ai-pr-reviewer.yml` in the repository you want to review:

```yaml
name: AI PR Review

on:
  pull_request_target:
    types:
      - opened
      - synchronize
      - reopened
      - ready_for_review

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Review PR
        uses: ai-dev-labs-open/ai-pr-reviewer@v1
        with:
          provider: anthropic
          model: claude-sonnet-4-6
          provider-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Add a provider secret

Go to **Settings → Secrets and variables → Actions** and add the secret that matches your chosen provider:

| Provider | Secret name | Where to get it |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/) |

### 3. Use with OpenAI instead

```yaml
        with:
          provider: openai
          model: gpt-4o
          provider-api-key: ${{ secrets.OPENAI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `provider` | Yes | `anthropic` | `anthropic` or `openai`. |
| `model` | Yes | — | Provider model identifier (e.g. `claude-sonnet-4-6`, `gpt-4o`). |
| `provider-api-key` | Yes | — | API key for the selected provider. |
| `github-token` | Yes | — | Token used to fetch PR files and write the sticky comment. |
| `max-files` | No | `20` | Max number of changed files to review. |
| `max-patch-chars` | No | `12000` | Max diff characters per file and per review chunk. |
| `fail-on-severity` | No | `none` | Fail the action when the highest finding meets or exceeds this severity: `none`, `low`, `medium`, `high`, `critical`. |
| `review-instructions` | No | — | Extra instructions appended to the system prompt. |

## Outputs

| Output | Description |
| --- | --- |
| `finding-count` | Number of normalized findings. |
| `highest-severity` | Highest finding severity or `none`. |
| `status` | `passed`, `failed`, or `errored`. |

### Gating a merge on review results

```yaml
      - name: Review PR
        id: review
        uses: ai-dev-labs-open/ai-pr-reviewer@v1
        with:
          provider: anthropic
          model: claude-sonnet-4-6
          provider-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-severity: high

      - name: Block on high severity
        if: steps.review.outputs.status == 'failed'
        run: exit 1
```

## Supported Providers

### Anthropic

Pass any Claude model ID as `model`. The action calls the Anthropic Messages API and reads the first `text` block from the response.

Recommended models: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`.

### OpenAI

Pass any Chat Completions model ID as `model`. The action calls the OpenAI Chat Completions API with `response_format: json_object`.

Recommended models: `gpt-4o`, `gpt-4o-mini`, `o3-mini`.

### Finding schema

Each provider returns findings in the same normalized shape:

```json
{
  "severity": "high",
  "file": "src/auth.ts",
  "title": "Missing authorization guard",
  "explanation": "The new route trusts caller input without verifying project ownership.",
  "suggested_test": "Add a request spec that asserts a non-member receives 403."
}
```

## Security Model

- Recommended trigger: `pull_request_target`
- Recommended permissions: `contents: read`, `pull-requests: write`, `issues: write`
- The action does not call `actions/checkout`
- The action does not run pull request code, install PR dependencies, or read files from the head branch
- Only GitHub API metadata and patch text are sent to the selected model provider

This keeps forked PR reviews safe while still allowing the action to post a sticky summary comment.

## Files Skipped by Default

The action automatically skips:

- **Lockfiles**: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock`, `Cargo.lock`, `go.sum`, `poetry.lock`, `composer.lock`, and others.
- **Generated files**: `.min.js`, `.min.css`, bundled and vendor assets, `dist/` build artifacts, protobuf-generated files, `.generated.ts` / `.g.cs`, `__generated__/` directories, `.snap` snapshot files, and similar patterns.
- **Binary or missing patches**: files with no diff text (images, blobs).
- **Files past the limit**: files beyond `max-files`.
- **Oversized patches**: individual patches larger than `max-patch-chars`.

All skipped files appear in the sticky comment with a brief reason.

## Local Dry Run

Use a saved fixture to inspect prompts, normalization, and rendering without GitHub events:

```bash
pnpm dry-run --fixture tests/fixtures/sample-pr.json --provider anthropic --model claude-sonnet-4-6
```

Set `PROVIDER_API_KEY` in the environment when running a real provider call locally.

## Example Output

See [demo output](docs/demo-output.md) for a representative sticky PR comment rendered from the fixture suite.

## Architecture

- [Architecture notes](docs/architecture.md)
- [Roadmap](docs/roadmap.md)

## Current Limitations

- No inline review comments in v1
- No auto-fix or patch suggestion output
- No repository config file; all configuration lives in workflow inputs
- Review quality is bounded by available diff context and model limits

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm build:action
```

The `build:action` script uses `@vercel/ncc` to produce the `dist/` artifact consumed by `action.yml`.

## Releasing

This repository follows the standard GitHub Action release pattern where `dist/` is committed to the repository so consumers can reference the action at a tag without running a build step.

### Creating a release

1. Ensure the branch is clean and all checks pass.
2. Push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The [release workflow](.github/workflows/release.yml) will:
   - Run lint, tests, typecheck, and `build:action`.
   - Commit the freshly built `dist/` back to the tag.
   - Create a GitHub Release with auto-generated notes.

### Keeping `dist/` in the repository

`dist/` is intentionally committed so that `uses: ai-dev-labs-open/ai-pr-reviewer@v1` works without any build step. The release workflow rebuilds `dist/` deterministically from the tagged source, so the committed artifact always matches the tag.

Local builds should not be committed directly to `main`; they are only committed as part of a release.
