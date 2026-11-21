import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAMAV_HTTP_MAX_BYTES,
  ClamavHttpScanner,
  ClamavScanError,
  effectiveDocumentUploadMaximumBytes,
  resolveClamavHttpConfiguration,
  type ClamavHttpConfiguration,
} from "../lib/clamav-http";

const configuration: ClamavHttpConfiguration = {
  url: "https://scan.example.test/api/v1/scan",
  token: "test-scanner-token",
  timeoutMs: 1_000,
};

const context = { documentId: "doc-001", fileName: "memo.pdf", mimeType: "application/pdf" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function cleanResponse(requestId = "scan-clean-001") {
  return {
    requestId,
    status: "clean",
    infected: false,
    threats: [],
    engine: "clamav",
    engineVersion: "1.5.4",
    scanDurationMs: 420,
    scannedAt: "2026-11-18T13:45:00Z",
  };
}

test("ClamAV HTTP client sends authenticated multipart bytes and accepts only a valid clean verdict", async () => {
  let observed: RequestInit | undefined;
  const scanner = new ClamavHttpScanner(configuration, (async (_input, init) => {
    observed = init;
    return jsonResponse(cleanResponse());
  }) as typeof fetch);
  const result = await scanner.scan(Buffer.from("%PDF-contract-test"), context);
  assert.equal(result.clean, true);
  assert.equal(result.requestId, "scan-clean-001");
  assert.equal(new Headers(observed?.headers).get("Authorization"), "Bearer test-scanner-token");
  assert.ok(new Headers(observed?.headers).get("X-Request-ID"));
  assert.ok(observed?.body instanceof FormData);
  const file = (observed?.body as FormData).get("file");
  assert.ok(file instanceof Blob);
  assert.equal(await file.text(), "%PDF-contract-test");
});

test("ClamAV HTTP client maps an EICAR infected verdict without retrying", async () => {
  const scanner = new ClamavHttpScanner(configuration, (async () => jsonResponse({
    ...cleanResponse("scan-eicar-001"),
    status: "infected",
    infected: true,
    threats: ["Eicar-Signature"],
  })) as typeof fetch);
  const result = await scanner.scan(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"), context);
  assert.equal(result.clean, false);
  assert.equal(result.signature, "Eicar-Signature");
});

test("ClamAV HTTP configuration requires server-side URL, token and bounded timeout", () => {
  assert.throws(() => resolveClamavHttpConfiguration({ CLAMAV_HTTP_URL: configuration.url } as unknown as NodeJS.ProcessEnv), (error: unknown) => error instanceof ClamavScanError && error.category === "CONFIGURATION" && !error.message.includes(configuration.token));
  assert.throws(() => resolveClamavHttpConfiguration({ CLAMAV_HTTP_URL: "http://scanner.example.test", CLAMAV_HTTP_TOKEN: configuration.token, NODE_ENV: "production" } as NodeJS.ProcessEnv), /must use HTTPS/);
  assert.throws(() => resolveClamavHttpConfiguration({ CLAMAV_HTTP_URL: configuration.url, CLAMAV_HTTP_TOKEN: configuration.token, CLAMAV_HTTP_TIMEOUT_MS: "0" } as unknown as NodeJS.ProcessEnv), /between 1000 and 120000/);
  assert.equal(resolveClamavHttpConfiguration({ CLAMAV_HTTP_URL: "http://127.0.0.1:8080/scan", CLAMAV_HTTP_TOKEN: configuration.token, CLAMAV_HTTP_TIMEOUT_MS: "30000", NODE_ENV: "development" } as NodeJS.ProcessEnv).timeoutMs, 30_000);
});

test("enabled scanning enforces the lower 20 MiB gateway limit while the administrative override keeps the configured limit", () => {
  const environment = { DOCUMENT_MAX_SIZE_MB: "50" } as unknown as NodeJS.ProcessEnv;
  assert.equal(effectiveDocumentUploadMaximumBytes(true, environment), CLAMAV_HTTP_MAX_BYTES);
  assert.equal(effectiveDocumentUploadMaximumBytes(false, environment), 50 * 1024 * 1024);
  assert.throws(() => effectiveDocumentUploadMaximumBytes(true, { DOCUMENT_MAX_SIZE_MB: "invalid" } as unknown as NodeJS.ProcessEnv), /DOCUMENT_MAX_SIZE_MB/);
});

test("ClamAV HTTP client rejects an oversized file before making a request", async () => {
  let calls = 0;
  const scanner = new ClamavHttpScanner(configuration, (async () => { calls++; return jsonResponse(cleanResponse()); }) as typeof fetch);
  await assert.rejects(() => scanner.scan(Buffer.alloc(CLAMAV_HTTP_MAX_BYTES + 1), context), (error: unknown) => error instanceof ClamavScanError && error.category === "OVERSIZED" && error.retryable === false);
  assert.equal(calls, 0);
});

test("ClamAV HTTP client fails closed for invalid authentication and malformed verdicts", async () => {
  const invalidToken = new ClamavHttpScanner(configuration, (async () => jsonResponse({ error: { code: "invalid_token" } }, 401)) as typeof fetch);
  await assert.rejects(() => invalidToken.scan(Buffer.from("%PDF-test"), context), (error: unknown) => error instanceof ClamavScanError && error.category === "AUTHENTICATION" && error.retryable === false && !error.message.includes(configuration.token));
  const malformed = new ClamavHttpScanner(configuration, (async () => jsonResponse({ ...cleanResponse(), infected: true })) as typeof fetch);
  await assert.rejects(() => malformed.scan(Buffer.from("%PDF-test"), context), (error: unknown) => error instanceof ClamavScanError && error.category === "MALFORMED_RESPONSE" && error.retryable === false);
});

test("ClamAV HTTP client classifies timeout, throttling, unavailable gateway and network interruption as retryable", async () => {
  const timeoutScanner = new ClamavHttpScanner({ ...configuration, timeoutMs: 5 }, ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  })) as typeof fetch);
  await assert.rejects(() => timeoutScanner.scan(Buffer.from("%PDF-test"), context), (error: unknown) => error instanceof ClamavScanError && error.category === "TIMEOUT" && error.retryable === true);

  for (const [status, category] of [[429, "RATE_LIMITED"], [503, "UNAVAILABLE"], [504, "UNAVAILABLE"]] as const) {
    const unavailable = new ClamavHttpScanner(configuration, (async () => jsonResponse({ error: { code: "unavailable" } }, status)) as typeof fetch);
    await assert.rejects(() => unavailable.scan(Buffer.from("%PDF-test"), context), (error: unknown) => error instanceof ClamavScanError && error.category === category && error.retryable === true);
  }

  const network = new ClamavHttpScanner(configuration, (async () => { throw new TypeError("socket closed"); }) as typeof fetch);
  await assert.rejects(() => network.scan(Buffer.from("%PDF-test"), context), (error: unknown) => error instanceof ClamavScanError && error.category === "NETWORK" && error.retryable === true);
});

test("repeated scan requests receive distinct correlation identifiers", async () => {
  const requestIds: string[] = [];
  const scanner = new ClamavHttpScanner(configuration, (async (_input, init) => {
    requestIds.push(new Headers(init?.headers).get("X-Request-ID") ?? "");
    return jsonResponse(cleanResponse(`scan-${requestIds.length}`));
  }) as typeof fetch);
  await scanner.scan(Buffer.from("%PDF-one"), context);
  await scanner.scan(Buffer.from("%PDF-two"), context);
  assert.equal(requestIds.length, 2);
  assert.notEqual(requestIds[0], requestIds[1]);
});
