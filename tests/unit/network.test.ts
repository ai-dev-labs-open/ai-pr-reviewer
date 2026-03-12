import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry, fetchWithTimeout } from "../../src/network";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when fetch completes within the timeout", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );

    const response = await fetchWithTimeout(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      5000
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects with a timeout error when the request exceeds the deadline", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;

        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }
      })
    );

    // Capture the rejection immediately so it is never flagged as unhandled by Node.js
    let caughtError: Error | undefined;
    const settled = fetchWithTimeout(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      1000
    ).catch((e: unknown) => {
      caughtError = e as Error;
    });

    await vi.advanceTimersByTimeAsync(1001);
    await settled;

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError?.message).toMatch(/timed out/i);
  });
});

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first successful response without retrying", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("ok", { status: 200 }))
    );

    const response = await fetchWithRetry(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      5000,
      2
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a 503 response and succeeds on the second attempt", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const retryPromise = fetchWithRetry(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      5000,
      1
    );

    await vi.runAllTimersAsync();

    const response = await retryPromise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400 client error", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("bad request", { status: 400 }))
    );

    const response = await fetchWithRetry(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      5000,
      2
    );

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the final error response after exhausting all retries on persistent 500 errors", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("error", { status: 500 }))
    );

    const retryPromise = fetchWithRetry(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      5000,
      2
    );

    await vi.runAllTimersAsync();

    const response = await retryPromise;

    expect(response.status).toBe(500);
    // 1 initial + 2 retries = 3 total
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries on network failure and succeeds on a later attempt", async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve, reject) => {
        callCount++;
        if (callCount === 1) {
          reject(new TypeError("first network error"));
        } else {
          resolve(new Response("ok", { status: 200 }));
        }
      })
    );

    const retryPromise = fetchWithRetry(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      5000,
      2
    );

    await vi.runAllTimersAsync();

    const response = await retryPromise;

    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
  });

  it("throws the last network error when all retries are exhausted (maxRetries=0)", async () => {
    const fetchMock = vi.fn(
      () => new Promise<Response>((_resolve, reject) => {
        reject(new TypeError("connection refused"));
      })
    );

    await expect(
      fetchWithRetry(
        fetchMock as unknown as typeof fetch,
        "https://example.com/api",
        {},
        5000,
        0
      )
    ).rejects.toThrow("connection refused");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws the last network error after multiple retries", async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const fetchMock = vi.fn(
      () => new Promise<Response>((_resolve, reject) => {
        callCount++;
        reject(new TypeError("network error"));
      })
    );

    // Capture the rejection immediately so it is never flagged as unhandled by Node.js
    let caughtError: Error | undefined;
    const settled = fetchWithRetry(
      fetchMock as unknown as typeof fetch,
      "https://example.com/api",
      {},
      5000,
      2
    ).catch((e: unknown) => {
      caughtError = e as Error;
    });

    await vi.runAllTimersAsync();
    await settled;

    expect(caughtError).toBeInstanceOf(TypeError);
    expect(caughtError?.message).toBe("network error");
    expect(callCount).toBe(3);
  });
});
