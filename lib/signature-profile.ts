import { createHash } from "crypto";
import { PDFDocument } from "pdf-lib";
import { detectDocumentMime } from "@/lib/document-validation";

export const MAXIMUM_SIGNATURE_IMAGE_BYTES = 1024 * 1024;
export const SIGNATURE_PROFILE_ATTESTATION = "I confirm this is my signature and authorize its governed use on ITF outputs.";

export function validateSignatureImage(bytes: Buffer, declaredMimeType: string) {
  if (!bytes.length || bytes.length > MAXIMUM_SIGNATURE_IMAGE_BYTES) {
    throw new Error("Signature image must be a non-empty PNG no larger than 1 MB.");
  }
  if (declaredMimeType !== "image/png" || detectDocumentMime(bytes) !== "image/png") {
    throw new Error("Signature image must be a valid PNG file.");
  }
  if (bytes.length < 24 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Signature image does not contain a valid PNG header.");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 10 || height < 10 || width > 3000 || height > 1500 || width * height > 4_000_000) {
    throw new Error("Signature image dimensions must be between 10×10 and 3000×1500 pixels.");
  }
  return {
    width,
    height,
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function assertSignatureImageDecodable(bytes: Buffer) {
  try {
    const document = await PDFDocument.create();
    await document.embedPng(bytes);
  } catch {
    throw new Error("Signature image must be a valid decodable PNG file.");
  }
}
