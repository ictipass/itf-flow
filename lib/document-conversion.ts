import { detectDocumentMime } from "@/lib/document-validation";

export const OFFICE_CONVERSION_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type DocumentConverterProviderName = "DISABLED" | "GOTENBERG";

export function documentConverterProvider(environment: NodeJS.ProcessEnv = process.env): DocumentConverterProviderName {
  const value = (environment.DOCUMENT_CONVERTER_PROVIDER ?? "DISABLED").trim().toUpperCase();
  if (value === "DISABLED" || value === "GOTENBERG") return value;
  throw new Error("DOCUMENT_CONVERTER_PROVIDER must be DISABLED or GOTENBERG.");
}

function gotenbergEndpoint(environment: NodeJS.ProcessEnv) {
  const base = environment.GOTENBERG_URL?.trim();
  if (!base) throw new Error("GOTENBERG_URL is required when DOCUMENT_CONVERTER_PROVIDER=GOTENBERG.");
  const url = new URL("/forms/libreoffice/convert", base.endsWith("/") ? base : `${base}/`);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("GOTENBERG_URL must use HTTPS unless it targets a local sidecar.");
  }
  return url;
}

export function assertDocumentConverterConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const provider = documentConverterProvider(environment);
  if (provider === "DISABLED") throw new Error("a production Office-to-PDF converter is not configured");
  gotenbergEndpoint(environment);
}

export async function convertOfficeDocumentToPdf(input: { bytes: Buffer; mimeType: string; originalName: string }, environment: NodeJS.ProcessEnv = process.env) {
  if (!OFFICE_CONVERSION_MIME_TYPES.has(input.mimeType)) return null;
  if (documentConverterProvider(environment) === "DISABLED") return null;
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }), input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180));
  form.append("exportFormFields", "false");
  form.append("flatten", "true");
  const response = await fetch(gotenbergEndpoint(environment), {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(Number(environment.DOCUMENT_CONVERTER_TIMEOUT_MS ?? "45000")),
  });
  if (!response.ok) throw new Error(`Gotenberg document conversion failed with status ${response.status}.`);
  const maximumBytes = Number(environment.DOCUMENT_MAX_SIZE_MB ?? "50") * 1024 * 1024;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maximumBytes || detectDocumentMime(bytes) !== "application/pdf") {
    throw new Error("Gotenberg returned an invalid or oversized PDF rendition.");
  }
  return bytes;
}
