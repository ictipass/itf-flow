const PDF = "application/pdf";
const JPEG = "image/jpeg";
const PNG = "image/png";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function detectDocumentMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return PDF;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return JPEG;
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return PNG;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const archive = bytes.subarray(Math.max(0, bytes.length - 256 * 1024)).toString("latin1");
    if (archive.includes("word/")) return DOCX;
    if (archive.includes("xl/")) return XLSX;
  }
  return null;
}
