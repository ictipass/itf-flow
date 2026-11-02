import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { memoOrganizationHeading } from "@/lib/memo-output";
import { richTextBlocks, type RichTextRun } from "@/lib/rich-text";

export const OUTGOING_LETTER_TEMPLATE_VERSION = "ITF_DEPARTMENT_LETTERHEAD_V1";

export type OutgoingLetterInput = {
  referenceNumber: string;
  classification: string;
  subject: string;
  body: string | null;
  summary: string;
  letterDate: Date;
  departmentName: string;
  departmentEmail: string;
  addressLines: string[];
  recipient: { name: string; organization?: string | null; email: string; address: string };
  director: { name: string; signaturePng?: Buffer | null } | null;
  finalizedBy?: string | null;
  generatedAt: Date;
  logoPng?: Buffer | null;
  draftPreview?: boolean;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 55;

function printable(value: string) {
  return value.normalize("NFKD").replace(/[^ -~]/g, "?");
}

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of printable(value).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderOutgoingLetter(input: OutgoingLetterInput) {
  const document = await PDFDocument.create();
  document.setTitle(`${input.referenceNumber}: ${input.subject}`);
  document.setAuthor("Industrial Training Fund - ITF Flow");
  document.setSubject("Official departmental outgoing correspondence");
  document.setCreator("ITF Flow");
  document.setProducer(`ITF Flow ${OUTGOING_LETTER_TEMPLATE_VERSION}`);
  document.setCreationDate(input.generatedAt);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await document.embedFont(StandardFonts.HelveticaBoldOblique);
  const logo = input.logoPng ? await document.embedPng(input.logoPng) : null;
  const signature = input.director?.signaturePng ? await document.embedPng(input.director.signaturePng) : null;
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = 678;

  function drawHeader(target = page) {
    if (logo) target.drawImage(logo, { x: 45, y: 741, width: 58, height: 58 });
    target.drawText("INDUSTRIAL TRAINING FUND", { x: 112, y: 774, size: 19, font: bold, color: rgb(0.06, 0.06, 0.06) });
    const department = memoOrganizationHeading(input.departmentName);
    const departmentSize = department.length > 56 ? 7.5 : 9;
    target.drawText(printable(department), { x: 112, y: 753, size: departmentSize, font: bold, color: rgb(0.12, 0.12, 0.12), maxWidth: 285 });
    target.drawLine({ start: { x: 409, y: 738 }, end: { x: 409, y: 805 }, thickness: 1.4, color: rgb(0.38, 0.06, 0.09) });
    let addressY = 795;
    for (const line of [...input.addressLines, `E-mail: ${input.departmentEmail}`]) {
      target.drawText(printable(line), { x: 419, y: addressY, size: 7.4, font: line.startsWith("E-mail:") ? bold : regular, color: rgb(0.12, 0.12, 0.12), maxWidth: 132 });
      addressY -= 10;
    }
    target.drawLine({ start: { x: 42, y: 729 }, end: { x: PAGE_WIDTH - 42, y: 729 }, thickness: 2.2, color: rgb(0.45, 0.03, 0.08) });
    target.drawLine({ start: { x: 42, y: 725 }, end: { x: PAGE_WIDTH - 42, y: 725 }, thickness: 0.55, color: rgb(0.45, 0.03, 0.08) });
  }

  function newPage() {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page);
    y = 696;
  }

  function ensure(height: number) {
    if (y - height < 64) newPage();
  }

  function text(value: string, options: { size?: number; font?: PDFFont; gap?: number; indent?: number } = {}) {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const indent = options.indent ?? 0;
    for (const line of wrap(value, font, size, PAGE_WIDTH - MARGIN * 2 - indent)) {
      ensure(size + 5);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: rgb(0.08, 0.08, 0.08) });
      y -= size + 4;
    }
    y -= options.gap ?? 5;
  }

  function runFont(run: RichTextRun, forceBold = false) {
    if ((run.bold || forceBold) && run.italic) return boldItalic;
    if (run.bold || forceBold) return bold;
    if (run.italic) return italic;
    return regular;
  }

  function richText(value: string) {
    for (const block of richTextBlocks(value)) {
      const size = block.kind === "heading" ? 11.5 : 10;
      const indent = block.kind === "blockquote" ? 15 : block.kind === "list-item" ? 12 : 0;
      const maximumWidth = PAGE_WIDTH - MARGIN * 2 - indent;
      const sourceRuns: RichTextRun[] = block.prefix ? [{ text: block.prefix, bold: true }, ...block.runs] : block.runs;
      let line: { value: string; run: RichTextRun; font: PDFFont }[] = [];
      let width = 0;
      let pendingSpace: { run: RichTextRun; font: PDFFont } | null = null;
      const lines: typeof line[] = [];
      const flush = () => { lines.push(line); line = []; width = 0; pendingSpace = null; };
      for (const run of sourceRuns) {
        const font = runFont(run, block.kind === "heading");
        for (const part of printable(run.text).split(/(\n|\s+)/)) {
          if (!part) continue;
          if (part === "\n") { flush(); continue; }
          if (/^\s+$/.test(part)) { if (line.length) pendingSpace = { run, font }; continue; }
          const spaceWidth = pendingSpace ? pendingSpace.font.widthOfTextAtSize(" ", size) : 0;
          const partWidth = font.widthOfTextAtSize(part, size);
          if (line.length && width + spaceWidth + partWidth > maximumWidth) flush();
          if (pendingSpace && line.length) {
            line.push({ value: " ", run: pendingSpace.run, font: pendingSpace.font });
            width += pendingSpace.font.widthOfTextAtSize(" ", size);
          }
          line.push({ value: part, run, font });
          width += partWidth;
          pendingSpace = null;
        }
      }
      if (line.length || !lines.length) flush();
      for (const rendered of lines) {
        ensure(size + 5);
        let x = MARGIN + indent;
        for (const token of rendered) {
          page.drawText(token.value, { x, y, size, font: token.font, color: rgb(0.08, 0.08, 0.08) });
          const tokenWidth = token.font.widthOfTextAtSize(token.value, size);
          if (token.run.underline && token.value.trim()) page.drawLine({ start: { x, y: y - 1 }, end: { x: x + tokenWidth, y: y - 1 }, thickness: 0.55 });
          x += tokenWidth;
        }
        y -= size + 4;
      }
      y -= block.kind === "heading" ? 7 : 5;
    }
  }

  drawHeader();
  text(input.referenceNumber, { font: bold, gap: 1 });
  text(input.letterDate.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }), { gap: 12 });
  text(input.recipient.name, { font: bold, gap: 1 });
  if (input.recipient.organization) text(input.recipient.organization, { gap: 1 });
  text(input.recipient.address, { gap: 14 });
  text(input.subject.toUpperCase(), { font: bold, gap: 10 });
  if (input.body?.trim()) richText(input.body);
  else text(input.summary, { gap: 14 });
  ensure(signature ? 125 : 78);
  text("Yours faithfully,", { gap: 5 });
  if (signature) {
    const width = 145;
    const height = Math.min(54, signature.height * (width / signature.width));
    page.drawImage(signature, { x: MARGIN, y: y - height, width, height });
    y -= height + 5;
  } else {
    text("[Director's signature appears on the finalized copy]", { size: 8, font: italic, gap: 5 });
  }
  if (input.director) text(input.director.name.toUpperCase(), { font: bold, gap: 1 });
  else text("DIRECTOR", { font: bold, gap: 1 });
  text("For: Director-General/CE", { font: bold, gap: 1 });

  const pages = document.getPages();
  pages.forEach((item, index) => {
    if (input.draftPreview) item.drawText("WORKING PREVIEW - NOT DISPATCHED", { x: 42, y: 370, size: 34, font: bold, color: rgb(0.72, 0.72, 0.72), rotate: degrees(35), opacity: 0.24 });
    item.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: PAGE_WIDTH - MARGIN, y: 42 }, thickness: 0.5, color: rgb(0.65, 0.65, 0.65) });
    item.drawText(`ITF Flow controlled ${input.draftPreview ? "working preview" : "official output"} | ${input.classification} | ${input.referenceNumber} | Page ${index + 1}/${pages.length}`, { x: MARGIN, y: 28, size: 6.5, font: regular, color: rgb(0.35, 0.35, 0.35) });
  });
  return Buffer.from(await document.save({ addDefaultPage: false, updateFieldAppearances: false, useObjectStreams: true }));
}
