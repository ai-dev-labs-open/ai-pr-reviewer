# Demo Output

```md
<!-- ai-pr-reviewer:sticky-comment -->
## AI PR Reviewer

Status: failed

- Findings: 2
- Highest severity: high
- Reviewed files: 3
- Skipped files: 1

### Findings

1. **[high]** `src/auth/session.ts` - Refresh token rotation can be bypassed
   The new branch updates the access token but leaves the previous refresh token valid, which allows replay after logout.
   Suggested test: Add an auth integration test that reuses the old refresh token after rotation and expects 401.

2. **[medium]** `src/routes/projects.ts` - Missing regression coverage for archived projects
   The new filter changes default visibility rules but the diff does not include tests for archived project access.
   Suggested test: Add a route spec for archived projects and assert non-admin users do not receive hidden records.

### Skipped Files

- `assets/logo.png`: patch is unavailable or binary

_Reviewed by ai-pr-reviewer with provider `anthropic` and model `your-model-id`._
```
