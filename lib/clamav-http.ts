import { randomUUID } from "crypto";
import { z } from "zod";

export const CLAMAV_HTTP_MAX_BYTES = 20 * 1024 * 1024;
const CLAMAV_HTTP_MAX_RESPONSE_BYTES = 64 * 1024;

export type ClamavErrorCategory =
  | "CONFIGURATION"
  | "OVERSIZED"
  | "AUTHENTICATION"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK"
  | "MALFORMED_RESPONSE"
  | "HTTP_ERROR";

export type ClamavHttpConfiguration = {
  url: string;
  token: string;
  timeoutMs: number;
};

export type MalwareScanContext = {
  documentId: string;
  fileName: string;
  mimeType: string;
};

export type MalwareScanResult = {
  clean: boolean;
  engine: string;
  engineVersion: string;
  signature?: string;
  threats: string[];
  requestId: string;
  clientRequestId: string;
  scanDurationMs: number;
  scannedAt: string;
};

const scanResponseSchema = z.object({
  requestId: z.string().trim().min(1).max(200),
  status: z.enum(["clean", "infected"]),
  infected: z.boolean(),
  threats: z.array(z.string().trim().min(1).max(500)).max(100),
  engine: z.literal("clamav"),
  engineVersion: z.string().trim().min(1).max(100),
  scanDurationMs: z.number().int().nonnegative().max(3_600_000),
  scannedAt: z.iso.datetime(),
}).strict();

export class ClamavScanError extends Error {
  constructor(
    message: string,
    readonly category: ClamavErrorCategory,
    readonly retryable: boolean,
    readonly clientRequestId?: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "ClamavScanError";
  }
}

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function documentScannerProvider(environment: NodeJS.ProcessEnv = process.env) {
  return (environment.DOCUMENT_SCANNER_PROVIDER ?? "DISABLED").trim().toUpperCase();
}

export function effectiveDocumentUploadMaximumBytes(scanningEnabled: boolean, environment: NodeJS.ProcessEnv = process.env) {
  const configuredMegabytes = Number(environment.DOCUMENT_MAX_SIZE_MB ?? "50");
  if (!Number.isFinite(configuredMegabytes) || configuredMegabytes <= 0 || configuredMegabytes > 1024) {
    throw new ClamavScanError("DOCUMENT_MAX_SIZE_MB must be greater than 0 and no more than 1024.", "CONFIGURATION", false);
  }
  const configuredBytes = Math.floor(configuredMegabytes * 1024 * 1024);
  return scanningEnabled ? Math.min(configuredBytes, CLAMAV_HTTP_MAX_BYTES) : configuredBytes;
}

export function resolveClamavHttpConfiguration(environment: NodeJS.ProcessEnv = process.env): ClamavHttpConfiguration {
  const rawUrl = environment.CLAMAV_HTTP_URL?.trim();
  if (!rawUrl) throw new ClamavScanError("CLAMAV_HTTP_URL is required for the ClamAV HTTP scanner.", "CONFIGURATION", false);
  let endpoint: URL;
  try {
    endpoint = new URL(rawUrl);
  } catch {
    throw new ClamavScanError("CLAMAV_HTTP_URL must be a valid absolute URL.", "CONFIGURATION", false);
  }
  if (endpoint.username || endpoint.password || endpoint.hash) {
    throw new ClamavScanError("CLAMAV_HTTP_URL must not contain credentials or a URL fragment.", "CONFIGURATION", false);
  }
  const production = environment.NODE_ENV === "production";
  if (endpoint.protocol !== "https:" && (production || endpoint.protocol !== "http:" || !isLoopback(endpoint.hostname))) {
    throw new ClamavScanError("CLAMAV_HTTP_URL must use HTTPS; plain HTTP is allowed only for a local development mock.", "CONFIGURATION", false);
  }
  const token = environment.CLAMAV_HTTP_TOKEN?.trim();
  if (!token) throw new ClamavScanError("CLAMAV_HTTP_TOKEN is required for the ClamAV HTTP scanner.", "CONFIGURATION", false);
  if (token.length > 4_096) throw new ClamavScanError("CLAMAV_HTTP_TOKEN exceeds the supported secret length.", "CONFIGURATION", false);
  const timeoutMs = Number(environment.CLAMAV_HTTP_TIMEOUT_MS ?? "30000");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new ClamavScanError("CLAMAV_HTTP_TIMEOUT_MS must be an integer between 1000 and 120000.", "CONFIGURATION", false);
  }
  return { url: endpoint.toString(), token, timeoutMs };
}

export function assertDocumentScannerConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const provider = documentScannerProvider(environment);
  if (provider === "CLAMAV" || provider === "CLAMAV_HTTP") {
    resolveClamavHttpConfiguration(environment);
    return;
  }
  if (provider === "MOCK" && environment.NODE_ENV !== "production") return;
  if (provider === "MOCK") throw new ClamavScanError("DOCUMENT_SCANNER_PROVIDER=MOCK is forbidden in production.", "CONFIGURATION", false);
  if (provider === "DISABLED") throw new ClamavScanError("A document scanner provider is required while MALWARE_SCANNER=ENABLED.", "CONFIGURATION", false);
  throw new ClamavScanError(`Unsupported document scanner provider: ${provider}.`, "CONFIGURATION", false);
}

function httpFailure(status: number, clientRequestId: string) {
  if (status === 401 || status === 403) return new ClamavScanError("The ClamAV gateway rejected scanner authentication.", "AUTHENTICATION", false, clientRequestId, status);
  if (status === 429) return new ClamavScanError("The ClamAV gateway rate limit was reached.", "RATE_LIMITED", true, clientRequestId, status);
  if (status === 503 || status === 504) return new ClamavScanError("The ClamAV gateway is temporarily unavailable.", "UNAVAILABLE", true, clientRequestId, status);
  if (status >= 500) return new ClamavScanError("The ClamAV gateway returned a server error.", "UNAVAILABLE", true, clientRequestId, status);
  return new ClamavScanError(`The ClamAV gateway rejected the scan request with HTTP ${status}.`, "HTTP_ERROR", false, clientRequestId, status);
}

export class ClamavHttpScanner {
  constructor(
    private readonly configuration: ClamavHttpConfiguration = resolveClamavHttpConfiguration(),
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async scan(bytes: Buffer, context: MalwareScanContext): Promise<MalwareScanResult> {
    const clientRequestId = randomUUID();
    if (!bytes.length || bytes.length > CLAMAV_HTTP_MAX_BYTES) {
      throw new ClamavScanError("The document exceeds the ClamAV HTTP gateway limit of 20 MiB.", "OVERSIZED", false, clientRequestId);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const form = new FormData();
      const safeFileName = context.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "document";
      form.append("file", new Blob([new Uint8Array(bytes)], { type: context.mimeType }), safeFileName);
      const response = await this.fetchImplementation(this.configuration.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.configuration.token}`,
          "X-Request-ID": clientRequestId,
        },
        body: form,
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) throw httpFailure(response.status, clientRequestId);
      let payload: unknown;
      try {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        const declaredLength = Number(response.headers.get("content-length") ?? "0");
        if (!contentType.includes("application/json") || (declaredLength && declaredLength > CLAMAV_HTTP_MAX_RESPONSE_BYTES)) throw new Error("invalid response envelope");
        const responseText = await response.text();
        if (Buffer.byteLength(responseText, "utf8") > CLAMAV_HTTP_MAX_RESPONSE_BYTES) throw new Error("response too large");
        payload = JSON.parse(responseText);
      } catch {
        throw new ClamavScanError("The ClamAV gateway returned invalid JSON.", "MALFORMED_RESPONSE", false, clientRequestId, response.status);
      }
      const parsed = scanResponseSchema.safeParse(payload);
      if (!parsed.success) throw new ClamavScanError("The ClamAV gateway response did not match contract version 1.0.", "MALFORMED_RESPONSE", false, clientRequestId, response.status);
      const result = parsed.data;
      const consistentClean = result.status === "clean" && result.infected === false && result.threats.length === 0;
      const consistentInfected = result.status === "infected" && result.infected === true;
      if (!consistentClean && !consistentInfected) {
        throw new ClamavScanError("The ClamAV gateway returned an inconsistent scan verdict.", "MALFORMED_RESPONSE", false, clientRequestId, response.status);
      }
      return {
        clean: consistentClean,
        engine: result.engine,
        engineVersion: result.engineVersion,
        signature: result.threats.join(", ") || undefined,
        threats: result.threats,
        requestId: result.requestId,
        clientRequestId,
        scanDurationMs: result.scanDurationMs,
        scannedAt: result.scannedAt,
      };
    } catch (error) {
      if (error instanceof ClamavScanError) throw error;
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new ClamavScanError("The ClamAV gateway request timed out.", "TIMEOUT", true, clientRequestId);
      }
      throw new ClamavScanError("The ClamAV gateway could not be reached.", "NETWORK", true, clientRequestId);
    } finally {
      clearTimeout(timeout);
    }
  }
}
