/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 878:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseActionConfig = parseActionConfig;
const errors_1 = __nccwpck_require__(847);
const SUPPORTED_PROVIDERS = new Set(["anthropic", "openai"]);
const SUPPORTED_FAILURE_LEVELS = new Set([
    "none",
    "low",
    "medium",
    "high",
    "critical"
]);
function parseActionConfig(env = process.env) {
    const provider = readProvider(env.INPUT_PROVIDER);
    return {
        provider,
        model: readRequired(env.INPUT_MODEL, "model"),
        providerApiKey: readRequired(env.INPUT_PROVIDER_API_KEY, "provider-api-key"),
        githubToken: readRequired(env.INPUT_GITHUB_TOKEN, "github-token"),
        maxFiles: readPositiveInteger(env.INPUT_MAX_FILES, "max-files", 20),
        maxPatchChars: readPositiveInteger(env.INPUT_MAX_PATCH_CHARS, "max-patch-chars", 12000),
        failOnSeverity: readFailureSeverity(env.INPUT_FAIL_ON_SEVERITY),
        reviewInstructions: readOptional(env.INPUT_REVIEW_INSTRUCTIONS)
    };
}
function readRequired(value, inputName) {
    const normalized = value?.trim();
    if (!normalized) {
        throw new errors_1.ConfigurationError(`Missing required input: ${inputName}.`);
    }
    return normalized;
}
function readOptional(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
function readProvider(value) {
    const normalized = readRequired(value, "provider").toLowerCase();
    if (!SUPPORTED_PROVIDERS.has(normalized)) {
        throw new errors_1.ConfigurationError(`Unsupported provider "${normalized}". Supported values: anthropic, openai.`);
    }
    return normalized;
}
function readFailureSeverity(value) {
    const normalized = (value?.trim().toLowerCase() ?? "none");
    if (!SUPPORTED_FAILURE_LEVELS.has(normalized)) {
        throw new errors_1.ConfigurationError(`Unsupported fail-on-severity "${normalized}". Supported values: none, low, medium, high, critical.`);
    }
    return normalized;
}
function readPositiveInteger(value, inputName, defaultValue) {
    const normalized = value?.trim();
    if (!normalized) {
        return defaultValue;
    }
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new errors_1.ConfigurationError(`Input "${inputName}" must be a positive integer.`);
    }
    return parsed;
}


/***/ }),

/***/ 851:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SUPPORTED_FILE_STATUSES = exports.STICKY_COMMENT_MARKER = void 0;
exports.STICKY_COMMENT_MARKER = "<!-- ai-pr-reviewer:sticky-comment -->";
exports.SUPPORTED_FILE_STATUSES = new Set(["added", "modified", "renamed"]);


/***/ }),

/***/ 847:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ReviewParseError = exports.ProviderError = exports.GitHubApiError = exports.ConfigurationError = void 0;
class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConfigurationError";
    }
}
exports.ConfigurationError = ConfigurationError;
class GitHubApiError extends Error {
    constructor(message) {
        super(message);
        this.name = "GitHubApiError";
    }
}
exports.GitHubApiError = GitHubApiError;
class ProviderError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProviderError";
    }
}
exports.ProviderError = ProviderError;
class ReviewParseError extends Error {
    constructor(message) {
        super(message);
        this.name = "ReviewParseError";
    }
}
exports.ReviewParseError = ReviewParseError;


/***/ }),

/***/ 572:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GitHubClient = void 0;
const errors_1 = __nccwpck_require__(847);
class GitHubClient {
    token;
    fetchImpl;
    apiBaseUrl;
    constructor(token, fetchImpl = fetch, apiBaseUrl = "https://api.github.com") {
        this.token = token;
        this.fetchImpl = fetchImpl;
        this.apiBaseUrl = apiBaseUrl;
    }
    async listPullRequestFiles(owner, repo, pullRequestNumber) {
        const files = [];
        for (let page = 1;; page += 1) {
            const pageResult = await this.request(`/repos/${owner}/${repo}/pulls/${pullRequestNumber}/files?per_page=100&page=${page}`);
            files.push(...pageResult);
            if (pageResult.length < 100) {
                return files;
            }
        }
    }
    async listIssueComments(owner, repo, issueNumber) {
        return this.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
    }
    async createIssueComment(owner, repo, issueNumber, body) {
        await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, "POST", { body });
    }
    async updateIssueComment(owner, repo, commentId, body) {
        await this.request(`/repos/${owner}/${repo}/issues/comments/${commentId}`, "PATCH", {
            body
        });
    }
    async request(path, method = "GET", body) {
        const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
            method,
            headers: {
                accept: "application/vnd.github+json",
                authorization: `Bearer ${this.token}`,
                "content-type": "application/json",
                "user-agent": "ai-pr-reviewer"
            },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) {
            const text = await response.text();
            throw new errors_1.GitHubApiError(`GitHub API request failed with status ${response.status}: ${text || response.statusText}`);
        }
        if (response.status === 204) {
            return undefined;
        }
        return (await response.json());
    }
}
exports.GitHubClient = GitHubClient;


/***/ }),

/***/ 15:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.readPullRequestContext = readPullRequestContext;
const promises_1 = __nccwpck_require__(455);
const errors_1 = __nccwpck_require__(847);
async function readPullRequestContext(eventPath, repositoryOverride) {
    const rawPayload = await (0, promises_1.readFile)(eventPath, "utf8");
    const payload = JSON.parse(rawPayload);
    const pullRequest = payload.pull_request;
    if (!pullRequest?.number) {
        throw new errors_1.ConfigurationError("The current GitHub event does not include a pull request.");
    }
    const repositoryFullName = repositoryOverride?.trim() || payload.repository?.full_name?.trim() || "";
    const [owner, repo] = repositoryFullName.split("/");
    if (!owner || !repo) {
        throw new errors_1.ConfigurationError("Unable to determine the owner/repository from the event.");
    }
    const baseRepositoryFullName = payload.repository?.full_name?.trim() ?? `${owner}/${repo}`;
    const headRepositoryFullName = pullRequest.head?.repo?.full_name?.trim() ?? baseRepositoryFullName;
    return {
        owner,
        repo,
        number: pullRequest.number,
        title: pullRequest.title?.trim() || "Untitled pull request",
        body: pullRequest.body?.trim() || "",
        url: pullRequest.html_url?.trim() || "",
        author: pullRequest.user?.login?.trim() || "unknown",
        baseRef: pullRequest.base?.ref?.trim() || "unknown",
        headRef: pullRequest.head?.ref?.trim() || "unknown",
        headSha: pullRequest.head?.sha?.trim() || "",
        isFork: headRepositoryFullName !== baseRepositoryFullName
    };
}


/***/ }),

/***/ 897:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.upsertStickyComment = upsertStickyComment;
const constants_1 = __nccwpck_require__(851);
async function upsertStickyComment(client, pullRequest, body) {
    const comments = await client.listIssueComments(pullRequest.owner, pullRequest.repo, pullRequest.number);
    const existingComment = comments.find((comment) => comment.body.includes(constants_1.STICKY_COMMENT_MARKER));
    if (existingComment) {
        await client.updateIssueComment(pullRequest.owner, pullRequest.repo, existingComment.id, body);
        return;
    }
    await client.createIssueComment(pullRequest.owner, pullRequest.repo, pullRequest.number, body);
}


/***/ }),

/***/ 274:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.runReviewPipeline = runReviewPipeline;
exports.createEmptyReviewRunResult = createEmptyReviewRunResult;
const diff_1 = __nccwpck_require__(192);
const normalize_1 = __nccwpck_require__(720);
const prompt_1 = __nccwpck_require__(257);
async function runReviewPipeline(input) {
    const prepared = (0, diff_1.prepareReviewInput)(input.files, input.config.maxFiles, input.config.maxPatchChars);
    if (prepared.chunks.length === 0) {
        return {
            summaries: ["No reviewable diff hunks were available."],
            findings: [],
            skippedFiles: prepared.skippedFiles,
            rawResponses: [],
            reviewedFiles: prepared.reviewableFiles.length,
            chunks: 0
        };
    }
    const chunkResults = [];
    const rawResponses = [];
    for (const chunk of prepared.chunks) {
        const prompt = (0, prompt_1.buildReviewPrompt)(input.pullRequest, chunk, input.config.reviewInstructions);
        const providerResponse = await input.provider.review({
            model: input.config.model,
            systemPrompt: prompt.systemPrompt,
            userPrompt: prompt.userPrompt
        });
        rawResponses.push(providerResponse.content);
        chunkResults.push((0, normalize_1.parseReviewResponse)(providerResponse.content));
    }
    const merged = (0, normalize_1.mergeChunkResults)(chunkResults);
    return {
        summaries: merged.summaries,
        findings: merged.findings,
        skippedFiles: prepared.skippedFiles,
        rawResponses,
        reviewedFiles: prepared.reviewableFiles.length,
        chunks: prepared.chunks.length
    };
}
function createEmptyReviewRunResult() {
    return {
        summaries: [],
        findings: [],
        skippedFiles: [],
        rawResponses: [],
        reviewedFiles: 0,
        chunks: 0
    };
}


/***/ }),

/***/ 303:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AnthropicProvider = void 0;
const errors_1 = __nccwpck_require__(847);
class AnthropicProvider {
    apiKey;
    fetchImpl;
    name = "anthropic";
    constructor(apiKey, fetchImpl = fetch) {
        this.apiKey = apiKey;
        this.fetchImpl = fetchImpl;
    }
    async review(request) {
        const response = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: request.model,
                max_tokens: 1400,
                system: request.systemPrompt,
                messages: [
                    {
                        role: "user",
                        content: request.userPrompt
                    }
                ]
            })
        });
        const responseJson = (await response.json());
        if (!response.ok) {
            throw new errors_1.ProviderError(`Anthropic request failed with status ${response.status}: ${responseJson.error?.message ?? "Unknown provider error."}`);
        }
        const content = responseJson.content
            ?.filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text?.trim() ?? "")
            .filter(Boolean)
            .join("\n");
        if (!content) {
            throw new errors_1.ProviderError("Anthropic response did not contain a text payload.");
        }
        return {
            content,
            usage: {
                inputTokens: responseJson.usage?.input_tokens,
                outputTokens: responseJson.usage?.output_tokens
            }
        };
    }
}
exports.AnthropicProvider = AnthropicProvider;


/***/ }),

/***/ 347:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createProvider = createProvider;
const anthropic_1 = __nccwpck_require__(303);
const openai_1 = __nccwpck_require__(669);
function createProvider(config, fetchImpl = fetch) {
    switch (config.provider) {
        case "anthropic":
            return new anthropic_1.AnthropicProvider(config.providerApiKey, fetchImpl);
        case "openai":
            return new openai_1.OpenAiProvider(config.providerApiKey, fetchImpl);
        default:
            throw new Error(`Unsupported provider: ${String(config.provider)}`);
    }
}


/***/ }),

/***/ 669:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OpenAiProvider = void 0;
const errors_1 = __nccwpck_require__(847);
class OpenAiProvider {
    apiKey;
    fetchImpl;
    name = "openai";
    constructor(apiKey, fetchImpl = fetch) {
        this.apiKey = apiKey;
        this.fetchImpl = fetchImpl;
    }
    async review(request) {
        const response = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: request.model,
                temperature: 0.1,
                response_format: {
                    type: "json_object"
                },
                messages: [
                    {
                        role: "system",
                        content: request.systemPrompt
                    },
                    {
                        role: "user",
                        content: request.userPrompt
                    }
                ]
            })
        });
        const responseJson = (await response.json());
        if (!response.ok) {
            throw new errors_1.ProviderError(`OpenAI request failed with status ${response.status}: ${responseJson.error?.message ?? "Unknown provider error."}`);
        }
        const content = responseJson.choices?.[0]?.message?.content?.trim();
        if (!content) {
            throw new errors_1.ProviderError("OpenAI response did not contain a completion payload.");
        }
        return {
            content,
            usage: {
                inputTokens: responseJson.usage?.prompt_tokens,
                outputTokens: responseJson.usage?.completion_tokens
            }
        };
    }
}
exports.OpenAiProvider = OpenAiProvider;


/***/ }),

/***/ 192:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.prepareReviewInput = prepareReviewInput;
exports.chunkReviewableFiles = chunkReviewableFiles;
const constants_1 = __nccwpck_require__(851);
function prepareReviewInput(files, maxFiles, maxPatchChars) {
    const reviewableFiles = [];
    const skippedFiles = [];
    for (const file of files) {
        if (!constants_1.SUPPORTED_FILE_STATUSES.has(file.status)) {
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
function chunkReviewableFiles(files, maxPatchChars) {
    const chunks = [];
    let currentFiles = [];
    let currentPatchChars = 0;
    for (const file of files) {
        const filePatchChars = file.patch.length;
        if (currentFiles.length > 0 &&
            currentPatchChars + filePatchChars > maxPatchChars) {
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


/***/ }),

/***/ 720:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseReviewResponse = parseReviewResponse;
exports.mergeChunkResults = mergeChunkResults;
const errors_1 = __nccwpck_require__(847);
const severity_1 = __nccwpck_require__(540);
function parseReviewResponse(raw) {
    const parsed = parseJsonPayload(raw);
    const summary = typeof parsed.summary === "string" && parsed.summary.trim()
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
function mergeChunkResults(results) {
    const uniqueSummaries = [...new Set(results.map((result) => result.summary.trim()))].filter(Boolean);
    const findingMap = new Map();
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
        findings: [...findingMap.values()].sort(severity_1.compareFindings)
    };
}
function isReviewFinding(value) {
    return Boolean(value);
}
function parseJsonPayload(raw) {
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
    throw new errors_1.ReviewParseError("Provider response was not valid JSON.");
}
function tryParse(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
function normalizeFinding(raw) {
    if (typeof raw.file !== "string" ||
        typeof raw.title !== "string" ||
        typeof raw.explanation !== "string") {
        return undefined;
    }
    const severityValue = typeof raw.severity === "string" ? (0, severity_1.normalizeSeverity)(raw.severity) : undefined;
    if (!severityValue) {
        return undefined;
    }
    const suggestedTestValue = typeof raw.suggested_test === "string"
        ? raw.suggested_test
        : typeof raw.suggestedTest === "string"
            ? raw.suggestedTest
            : "Add a regression test that proves the reported issue is fixed.";
    const normalized = {
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


/***/ }),

/***/ 257:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.buildReviewPrompt = buildReviewPrompt;
function buildReviewPrompt(pullRequest, chunk, reviewInstructions) {
    const systemPrompt = [
        "You are a senior software engineer performing pull request review.",
        "Focus on correctness bugs, security issues, behavior regressions, data-loss risks, concurrency hazards, and missing tests.",
        "Ignore style-only feedback unless it directly causes a defect.",
        "Review only the provided diff. Do not speculate about files or code that are not present in the patch.",
        "Return strict JSON with this shape and nothing else:",
        '{"summary":"one sentence","findings":[{"severity":"low|medium|high|critical","file":"path/to/file","title":"short finding title","explanation":"why this matters","suggested_test":"specific test to add"}]}'
    ].join("\n");
    const filesSection = chunk.files
        .map((file) => {
        const renameLine = file.previousFilename
            ? `Previous filename: ${file.previousFilename}\n`
            : "";
        return [
            `### ${file.filename}`,
            `Status: ${file.status}; additions: ${file.additions}; deletions: ${file.deletions}; changes: ${file.changes}`,
            renameLine + "```diff",
            file.patch,
            "```"
        ].join("\n");
    })
        .join("\n\n");
    const extraInstructions = reviewInstructions
        ? `\nAdditional maintainer instructions:\n${reviewInstructions}\n`
        : "";
    const prBody = pullRequest.body.trim() || "No pull request description was provided.";
    const userPrompt = [
        `Repository: ${pullRequest.owner}/${pullRequest.repo}`,
        `Pull request: #${pullRequest.number} - ${pullRequest.title}`,
        `Author: ${pullRequest.author}`,
        `URL: ${pullRequest.url}`,
        `Base branch: ${pullRequest.baseRef}`,
        `Head branch: ${pullRequest.headRef}`,
        `Forked pull request: ${pullRequest.isFork ? "yes" : "no"}`,
        `Chunk: ${chunk.id}`,
        "",
        "Pull request description:",
        prBody,
        extraInstructions,
        "Changed files in this chunk:",
        filesSection,
        "",
        "Return valid JSON only."
    ]
        .filter(Boolean)
        .join("\n");
    return { systemPrompt, userPrompt };
}


/***/ }),

/***/ 447:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.renderReviewComment = renderReviewComment;
const constants_1 = __nccwpck_require__(851);
function renderReviewComment(input) {
    const lines = [
        constants_1.STICKY_COMMENT_MARKER,
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
    }
    else if (input.result.findings.length === 0) {
        lines.push("", "### Findings", "", input.result.reviewedFiles > 0
            ? "No actionable findings in the reviewed diff."
            : "No reviewable diff hunks were available for this pull request.");
    }
    else {
        lines.push("", "### Findings", "");
        input.result.findings.forEach((finding, index) => {
            lines.push(`${index + 1}. **[${finding.severity}]** \`${finding.file}\` - ${finding.title}`, `   ${finding.explanation}`, `   Suggested test: ${finding.suggestedTest}`, "");
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
    lines.push("", `_Reviewed by ai-pr-reviewer with provider \`${input.config.provider}\` and model \`${input.config.model}\`._`);
    return lines.join("\n");
}
function formatSkippedReason(reason) {
    switch (reason) {
        case "binary_or_missing_patch":
            return "patch is unavailable or binary";
        case "unsupported_status":
            return "file status is not reviewed in v1";
        case "file_limit":
            return "skipped because the max file limit was reached";
        case "patch_too_large":
            return "patch exceeded the configured max patch size";
        default:
            return "skipped";
    }
}


/***/ }),

/***/ 540:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.compareFindings = compareFindings;
exports.getHighestSeverity = getHighestSeverity;
exports.shouldFailForSeverity = shouldFailForSeverity;
exports.normalizeSeverity = normalizeSeverity;
const SEVERITY_ORDER = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
};
function compareFindings(a, b) {
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
function getHighestSeverity(findings) {
    if (findings.length === 0) {
        return "none";
    }
    return findings.reduce((highest, current) => {
        return SEVERITY_ORDER[current.severity] > SEVERITY_ORDER[highest]
            ? current.severity
            : highest;
    }, "low");
}
function shouldFailForSeverity(highestSeverity, threshold) {
    if (highestSeverity === "none" || threshold === "none") {
        return false;
    }
    return SEVERITY_ORDER[highestSeverity] >= SEVERITY_ORDER[threshold];
}
function normalizeSeverity(value) {
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


/***/ }),

/***/ 455:
/***/ ((module) => {

module.exports = require("node:fs/promises");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.runAction = runAction;
const promises_1 = __nccwpck_require__(455);
const config_1 = __nccwpck_require__(878);
const context_1 = __nccwpck_require__(15);
const api_1 = __nccwpck_require__(572);
const sticky_comment_1 = __nccwpck_require__(897);
const pipeline_1 = __nccwpck_require__(274);
const providers_1 = __nccwpck_require__(347);
const render_1 = __nccwpck_require__(447);
const severity_1 = __nccwpck_require__(540);
async function runAction(env = process.env, fetchImpl = fetch) {
    let result = (0, pipeline_1.createEmptyReviewRunResult)();
    let status = "passed";
    let highestSeverity = "none";
    let config;
    let pullRequest;
    let client;
    try {
        config = (0, config_1.parseActionConfig)(env);
        const eventPath = env.GITHUB_EVENT_PATH?.trim();
        if (!eventPath) {
            throw new Error("GITHUB_EVENT_PATH is required for the action runtime.");
        }
        pullRequest = await (0, context_1.readPullRequestContext)(eventPath, env.GITHUB_REPOSITORY);
        client = new api_1.GitHubClient(config.githubToken, fetchImpl, env.GITHUB_API_URL);
        const files = await client.listPullRequestFiles(pullRequest.owner, pullRequest.repo, pullRequest.number);
        const provider = (0, providers_1.createProvider)(config, fetchImpl);
        result = await (0, pipeline_1.runReviewPipeline)({
            config,
            provider,
            pullRequest,
            files
        });
        highestSeverity = (0, severity_1.getHighestSeverity)(result.findings);
        status = (0, severity_1.shouldFailForSeverity)(highestSeverity, config.failOnSeverity)
            ? "failed"
            : "passed";
        const body = (0, render_1.renderReviewComment)({
            config,
            result,
            status,
            highestSeverity
        });
        await (0, sticky_comment_1.upsertStickyComment)(client, pullRequest, body);
        await writeOutputs(env, status, highestSeverity, result.findings.length);
        return {
            status,
            highestSeverity,
            findingCount: result.findings.length
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await writeOutputs(env, "errored", highestSeverity, result.findings.length);
        if (config && pullRequest && client) {
            const body = (0, render_1.renderReviewComment)({
                config,
                result,
                status: "errored",
                highestSeverity,
                errorMessage
            });
            try {
                await (0, sticky_comment_1.upsertStickyComment)(client, pullRequest, body);
            }
            catch (commentError) {
                console.error("Failed to update sticky comment:", commentError);
            }
        }
        throw error;
    }
}
async function writeOutputs(env, status, highestSeverity, findingCount) {
    const outputPath = env.GITHUB_OUTPUT?.trim();
    if (!outputPath) {
        return;
    }
    const lines = [
        `status=${status}`,
        `highest-severity=${highestSeverity}`,
        `finding-count=${findingCount}`
    ];
    await (0, promises_1.appendFile)(outputPath, `${lines.join("\n")}\n`, "utf8");
}
if (require.main === require.cache[eval('__filename')]) {
    void (async () => {
        try {
            const actionResult = await runAction();
            if (actionResult.status === "failed") {
                console.error(`Review found ${actionResult.highestSeverity} severity issues that met the configured failure threshold.`);
                process.exitCode = 1;
            }
        }
        catch (error) {
            console.error(error);
            process.exitCode = 1;
        }
    })();
}

})();

module.exports = __webpack_exports__;
/******/ })()
;