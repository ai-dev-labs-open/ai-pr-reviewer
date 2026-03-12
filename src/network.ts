/**
 * Timeout (ms) applied to every outbound HTTP request.
 * Keeps CI from hanging on slow or unresponsive upstream services.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Maximum number of additional attempts after the first failure.
 * Total attempts = 1 + MAX_RETRIES.
 */
export const MAX_RETRIES = 2;

/**
 * Base delay (ms) for exponential backoff between retries.
 */
const BASE_DELAY_MS = 500;

/**
 * HTTP status codes that are safe to retry (transient server-side errors).
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Wraps fetch with a request timeout via AbortController.
 * Throws a descriptive error when the deadline is exceeded.
 */
export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: string | URL,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${String(input)}`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls fetchWithTimeout and retries on transient network or server errors.
 * Throws on the final attempt failure.
 */
export async function fetchWithRetry(
  fetchImpl: typeof fetch,
  input: string | URL,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    try {
      const response = await fetchWithTimeout(fetchImpl, input, init, timeoutMs);

      if (attempt < maxRetries && RETRYABLE_STATUS_CODES.has(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
