import { detectDocumentMime } from "@/lib/document-validation";

const MAXIMUM_INK_BYTES = 4 * 1024 * 1024;

export function parseAnnotationInk(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const match = /^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Stylus annotation must be submitted as a PNG drawing.");
  const bytes = Buffer.from(match[1], "base64");
  if (!bytes.length || bytes.length > MAXIMUM_INK_BYTES || detectDocumentMime(bytes) !== "image/png") {
    throw new Error("Stylus annotation is invalid or exceeds the 4 MB limit.");
  }
  return bytes;
}

export function annotationInputMethod(minuteText: string, ink: Buffer | null) {
  if (minuteText && ink) return "TEXT_AND_INK";
  if (ink) return "INK";
  if (minuteText) return "TEXT";
  throw new Error("Enter a typed minute or write directly on the document before saving.");
}
