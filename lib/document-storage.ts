import { createHash, randomUUID } from "crypto";
import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const allowedMimeTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png"]);
const storageRoot = path.resolve(process.cwd(), "storage", "uploads");

export type StoredDocument = { originalName: string; mimeType: string; sizeBytes: number; storageKey: string; sha256: string; storageProvider: "LOCAL"; malwareScanStatus: "PENDING"; processingStatus: "QUARANTINED" };
export interface DocumentProvider { storeQuarantined(input: { correspondenceId: string; originalName: string; bytes: Buffer }): Promise<{ storageKey: string }>; read(storageKey: string): Promise<Buffer>; release(storageKey: string): Promise<string>; }

function resolved(key: string) { const absolute = path.resolve(storageRoot, key); if (!absolute.startsWith(`${storageRoot}${path.sep}`)) throw new Error("Invalid document storage key."); return absolute; }
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "document";

export const localDocumentProvider: DocumentProvider = {
  async storeQuarantined(input) { const key = `quarantine/${input.correspondenceId}/${randomUUID()}-${safeName(input.originalName)}`; const target = resolved(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, input.bytes, { flag: "wx" }); return { storageKey: key }; },
  async read(storageKey) { return readFile(resolved(storageKey)); },
  async release(storageKey) { if (storageKey.startsWith("released/")) return storageKey; const releasedKey = storageKey.startsWith("quarantine/") ? storageKey.replace(/^quarantine\//, "released/") : `released/legacy/${storageKey}`; const target = resolved(releasedKey); await mkdir(path.dirname(target), { recursive: true }); await copyFile(resolved(storageKey), target); return releasedKey; },
};

export function documentProvider(name = process.env.DOCUMENT_STORAGE_PROVIDER ?? "LOCAL") { if (name !== "LOCAL") throw new Error(`Document provider ${name} is not available until the EDMS contract is configured.`); return localDocumentProvider; }

export async function storeDocument(input: { correspondenceId: string; originalName: string; mimeType: string; bytes: Buffer }): Promise<StoredDocument> {
  const maximumBytes = Number(process.env.DOCUMENT_MAX_SIZE_MB ?? "50") * 1024 * 1024;
  if (!allowedMimeTypes.has(input.mimeType) || !input.bytes.length || input.bytes.length > maximumBytes) throw new Error("Document type is not permitted or the document exceeds the configured size limit.");
  const provider = documentProvider();
  const stored = await provider.storeQuarantined(input);
  return { originalName: input.originalName, mimeType: input.mimeType, sizeBytes: input.bytes.length, storageKey: stored.storageKey, sha256: createHash("sha256").update(input.bytes).digest("hex"), storageProvider: "LOCAL", malwareScanStatus: "PENDING", processingStatus: "QUARANTINED" };
}

export async function readStoredDocument(storageKey: string, provider = "LOCAL") { return documentProvider(provider).read(storageKey); }
export async function releaseStoredDocument(storageKey: string, provider = "LOCAL") { return documentProvider(provider).release(storageKey); }
