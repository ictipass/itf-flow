import { createHash, randomUUID } from "crypto";
import { copy, get, put } from "@vercel/blob";
import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);
const storageRoot = path.resolve(process.cwd(), "storage", "uploads");

export type DocumentStorageProviderName = "LOCAL" | "VERCEL_BLOB";
export type StoredDocument = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  sha256: string;
  storageProvider: DocumentStorageProviderName;
  malwareScanStatus: "PENDING";
  processingStatus: "QUARANTINED";
};

type DocumentInput = {
  correspondenceId: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
};

export interface DocumentProvider {
  readonly name: DocumentStorageProviderName;
  storeQuarantined(input: DocumentInput): Promise<{ storageKey: string }>;
  read(storageKey: string): Promise<Buffer>;
  release(storageKey: string): Promise<string>;
}

function resolved(key: string) {
  const absolute = path.resolve(storageRoot, key);
  if (!absolute.startsWith(`${storageRoot}${path.sep}`)) throw new Error("Invalid document storage key.");
  return absolute;
}

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "document";

function storageKey(input: Pick<DocumentInput, "correspondenceId" | "originalName">) {
  return `quarantine/${input.correspondenceId}/${randomUUID()}-${safeName(input.originalName)}`;
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required when DOCUMENT_STORAGE_PROVIDER=VERCEL_BLOB.");
  return token;
}

function assertBlobStorageKey(key: string) {
  if (!/^(quarantine|released)\/[a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) {
    throw new Error("Invalid Vercel Blob document storage key.");
  }
}

export const localDocumentProvider: DocumentProvider = {
  name: "LOCAL",
  async storeQuarantined(input) {
    const key = storageKey(input);
    const target = resolved(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.bytes, { flag: "wx" });
    return { storageKey: key };
  },
  async read(key) {
    return readFile(resolved(key));
  },
  async release(key) {
    if (key.startsWith("released/")) return key;
    const releasedKey = key.startsWith("quarantine/") ? key.replace(/^quarantine\//, "released/") : `released/legacy/${key}`;
    const target = resolved(releasedKey);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(resolved(key), target);
    return releasedKey;
  },
};

export const vercelBlobDocumentProvider: DocumentProvider = {
  name: "VERCEL_BLOB",
  async storeQuarantined(input) {
    const key = storageKey(input);
    const stored = await put(key, input.bytes, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
      contentType: input.mimeType,
      token: blobToken(),
    });
    return { storageKey: stored.pathname };
  },
  async read(key) {
    assertBlobStorageKey(key);
    const stored = await get(key, {
      access: "private",
      token: blobToken(),
      useCache: false,
    });
    if (!stored || stored.statusCode !== 200 || !stored.stream) throw new Error("Stored document was not found in Vercel Blob.");
    return Buffer.from(await new Response(stored.stream).arrayBuffer());
  },
  async release(key) {
    assertBlobStorageKey(key);
    if (key.startsWith("released/")) return key;
    const releasedKey = key.replace(/^quarantine\//, "released/");
    const released = await copy(key, releasedKey, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      token: blobToken(),
    });
    return released.pathname;
  },
};

export function documentProvider(name = process.env.DOCUMENT_STORAGE_PROVIDER ?? "LOCAL") {
  const normalized = name.trim().toUpperCase();
  if (normalized === "LOCAL") return localDocumentProvider;
  if (normalized === "VERCEL_BLOB") return vercelBlobDocumentProvider;
  throw new Error(`Unsupported document storage provider: ${name}.`);
}

export async function storeDocument(input: DocumentInput): Promise<StoredDocument> {
  const maximumBytes = Number(process.env.DOCUMENT_MAX_SIZE_MB ?? "50") * 1024 * 1024;
  if (!allowedMimeTypes.has(input.mimeType) || !input.bytes.length || input.bytes.length > maximumBytes) {
    throw new Error("Document type is not permitted or the document exceeds the configured size limit.");
  }
  const provider = documentProvider();
  const stored = await provider.storeQuarantined(input);
  return {
    originalName: input.originalName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.length,
    storageKey: stored.storageKey,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    storageProvider: provider.name,
    malwareScanStatus: "PENDING",
    processingStatus: "QUARANTINED",
  };
}

export async function readStoredDocument(storageKey: string, provider = "LOCAL") {
  return documentProvider(provider).read(storageKey);
}

export async function releaseStoredDocument(storageKey: string, provider = "LOCAL") {
  return documentProvider(provider).release(storageKey);
}
