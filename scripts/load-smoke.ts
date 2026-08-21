import "dotenv/config";

const target = new URL("/api/health/live", process.env.LOAD_TEST_BASE_URL ?? "http://localhost:3001").toString();
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? "100");
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? "10");
const maximumP95 = Number(process.env.LOAD_TEST_MAX_P95_MS ?? "1000");
if (!Number.isInteger(requests) || requests < 1 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) throw new Error("Invalid load-smoke configuration.");

const durations: number[] = []; let failures = 0; let cursor = 0;
async function worker() { while (cursor < requests) { cursor += 1; const start = performance.now(); try { const response = await fetch(target, { signal: AbortSignal.timeout(5000) }); if (!response.ok) failures += 1; } catch { failures += 1; } durations.push(performance.now() - start); } }
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
durations.sort((a, b) => a - b); const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)];
console.log(JSON.stringify({ target, requests, concurrency, failures, p95Ms: Math.round(p95), thresholdMs: maximumP95 }, null, 2));
if (failures || p95 > maximumP95) process.exitCode = 1;
