import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export const ANNOTATABLE_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AnnotationPlacement = "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "CUSTOM";

export function isAnnotatableDocument(mimeType: string) {
  return ANNOTATABLE_DOCUMENT_TYPES.includes(mimeType as (typeof ANNOTATABLE_DOCUMENT_TYPES)[number]);
}

function printable(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

function wrapText(value: string, font: PDFFont, size: number, maximumWidth: number) {
  const lines: string[] = [];
  for (const paragraph of printable(value).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maximumWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    else if (!words.length) lines.push("");
  }
  return lines;
}

async function normalizedPdf(source: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return PDFDocument.load(source, { updateMetadata: false });
  const document = await PDFDocument.create();
  const image = mimeType === "image/jpeg" ? await document.embedJpg(source) : await document.embedPng(source);
  const page = document.addPage([595.28, 841.89]);
  const margin = 24;
  const scale = Math.min((page.getWidth() - margin * 2) / image.width, (page.getHeight() - margin * 2) / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
  return document;
}

function annotationPosition(page: PDFPage, boxWidth: number, boxHeight: number, placement: AnnotationPlacement, placementX?: number | null, placementY?: number | null) {
  const margin = 22;
  if (placement === "CUSTOM") {
    const normalizedX = Math.min(1, Math.max(0, placementX ?? .65));
    const normalizedY = Math.min(1, Math.max(0, placementY ?? .08));
    return { x: normalizedX * (page.getWidth() - boxWidth), y: (1 - normalizedY) * (page.getHeight() - boxHeight) };
  }
  return {
    x: placement.endsWith("RIGHT") ? page.getWidth() - boxWidth - margin : margin,
    y: placement.startsWith("TOP") ? page.getHeight() - boxHeight - margin : margin,
  };
}

export async function annotateDocument(input: {
  source: Buffer;
  mimeType: string;
  pageNumber: number;
  placement: AnnotationPlacement;
  placementX?: number | null;
  placementY?: number | null;
  minuteText: string;
  inkPng?: Buffer | null;
  signerName: string;
  signerRole: string;
  signerPosition?: string | null;
  authorityPrincipalName?: string | null;
  signedAt: Date;
}) {
  if (!isAnnotatableDocument(input.mimeType)) throw new Error("Only PDF, JPEG and PNG documents can be annotated.");
  const document = await normalizedPdf(input.source, input.mimeType);
  const pages = document.getPages();
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > pages.length) {
    throw new Error(`Select a page between 1 and ${pages.length}.`);
  }
  const page = pages[input.pageNumber - 1];
  if (input.inkPng) {
    const ink = await document.embedPng(input.inkPng);
    page.drawImage(ink, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = Math.min(280, Math.max(180, page.getWidth() - 44));
  const textSize = 9;
  const innerWidth = width - 24;
  const lines = wrapText(input.minuteText, regular, textSize, innerWidth);
  const identity = `${input.signerName} | ${input.signerRole}${input.signerPosition ? ` | ${input.signerPosition}` : ""}`;
  const identityLines = wrapText(identity, regular, 7.5, innerWidth);
  const authorityLines = input.authorityPrincipalName
    ? wrapText(`Acting for: ${input.authorityPrincipalName}`, regular, 7.5, innerWidth)
    : [];
  const height = Math.min(page.getHeight() - 44, 60 + lines.length * 12 + (identityLines.length + authorityLines.length) * 9);
  const { x, y } = annotationPosition(page, width, height, input.placement, input.placementX, input.placementY);
  page.drawRectangle({ x, y, width, height, color: rgb(1, 0.98, 0.82), borderColor: rgb(0.42, 0.08, 0.14), borderWidth: 1.5, opacity: 0.94 });
  let cursor = y + height - 17;
  page.drawText("ITF FLOW AUTHENTICATED MINUTE", { x: x + 12, y: cursor, size: 8, font: bold, color: rgb(0.42, 0.02, 0.08) });
  cursor -= 16;
  for (const line of lines) {
    if (cursor < y + 30) break;
    page.drawText(line, { x: x + 12, y: cursor, size: textSize, font: regular, color: rgb(0.08, 0.08, 0.08) });
    cursor -= 12;
  }
  cursor = Math.max(y + 20, cursor - 3);
  for (const line of [...identityLines, ...authorityLines]) {
    page.drawText(line, { x: x + 12, y: cursor, size: 7.5, font: bold, color: rgb(0.32, 0.04, 0.09) });
    cursor -= 9;
  }
  page.drawText(`${input.signedAt.toISOString()} | Page ${input.pageNumber}/${pages.length}`, { x: x + 12, y: y + 8, size: 6.5, font: regular, color: rgb(0.25, 0.25, 0.25) });
  const bytes = await document.save({ addDefaultPage: false, updateFieldAppearances: false, useObjectStreams: true });
  return { bytes: Buffer.from(bytes), pageCount: pages.length };
}
