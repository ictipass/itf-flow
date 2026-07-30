import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

export type StoredDocument = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  sha256: string;
  storageProvider: "LOCAL";
};

export async function storeDocument(input: {
  correspondenceId: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<StoredDocument> {
  const maximumBytes = Number(process.env.DOCUMENT_MAX_SIZE_MB ?? "50") * 1024 * 1024;
  if (!allowedMimeTypes.has(input.mimeType) || input.bytes.length > maximumBytes) {
    throw new Error("Document type is not permitted or the document exceeds the configured size limit.");
  }

  // Production gate: this adapter must be preceded by magic-byte validation and
  // a malware scanner before DOCUMENT_STORAGE_PROVIDER is changed from LOCAL.
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${input.correspondenceId}/${crypto.randomUUID()}-${safeName}`;
  const storageRoot = path.resolve(process.cwd(), "storage", "uploads");
  const directory = path.join(storageRoot, input.correspondenceId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(storageRoot, storageKey), input.bytes, { flag: "wx" });

  return {
    originalName: input.originalName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.length,
    storageKey,
    sha256,
    storageProvider: "LOCAL",
  };
}

export async function readStoredDocument(storageKey: string) {
  const storageRoot = path.resolve(process.cwd(), "storage", "uploads");
  const absolutePath = path.resolve(storageRoot, storageKey);
  if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Invalid document storage key.");
  }
  return readFile(absolutePath);
}
