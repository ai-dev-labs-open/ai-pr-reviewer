# AI PR Reviewer

`ai-pr-reviewer` is a secure GitHub Action for reviewing pull request diffs with Anthropic or OpenAI and posting one sticky summary comment back to the PR.

It is built for public repositories, forked pull requests, and automated review workflows where running untrusted PR code is not acceptable. The action never checks out or executes the pull request branch. It only reads pull request metadata and changed-file patches through the GitHub API.

## Why This Exists

- Keep PR review focused on bugs, regressions, security risks, and missing tests.
- Support multiple model providers without changing the review pipeline.
- Preserve a low-noise workflow by updating one sticky comment instead of scattering inline comments.
- Keep local development straightforward with a fixture-driven dry-run command.

## Features

- GitHub Action designed around `pull_request_target`
- Anthropic and OpenAI provider adapters behind one interface
- Diff filtering, chunking, normalization, deduplication, and severity ranking
- Sticky PR summary comment with outputs for downstream workflow gating
- Local dry-run mode for reviewing saved fixtures without GitHub events

## Quick Start

Create `.github/workflows/ai-pr-reviewer.yml` in the repository that wants reviews:

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
        uses: ai-dev-labs-open/ai-pr-reviewer@main
        with:
          provider: anthropic
          model: your-model-id
          provider-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          max-files: 20
          max-patch-chars: 12000
          fail-on-severity: high
```

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `provider` | Yes | `anthropic` or `openai`. |
| `model` | Yes | Provider model identifier. |
| `provider-api-key` | Yes | Provider API key. |
| `github-token` | Yes | Token used to fetch PR files and write the sticky comment. |
| `max-files` | No | Max number of changed files to review. Default: `20`. |
| `max-patch-chars` | No | Max diff characters per file and per chunk. Default: `12000`. |
| `fail-on-severity` | No | Fail threshold: `none`, `low`, `medium`, `high`, `critical`. |
| `review-instructions` | No | Extra instructions appended to the review prompt. |

## Outputs

| Output | Description |
| --- | --- |
| `finding-count` | Number of normalized findings. |
| `highest-severity` | Highest finding severity or `none`. |
| `status` | `passed`, `failed`, or `errored`. |

## Supported Providers

- Anthropic via the Messages API
- OpenAI via the Chat Completions API

Each provider uses the same review pipeline and result schema:

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

## Local Dry Run

Use a saved fixture to inspect prompts, normalization, and rendering without GitHub events:

```bash
pnpm dry-run --fixture tests/fixtures/sample-pr.json --provider anthropic --model your-model-id
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
