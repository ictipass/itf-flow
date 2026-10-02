import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { richTextBlocks, type RichTextRun } from "@/lib/rich-text";

export const MEMO_TEMPLATE_VERSION = "ITF_MEMO_V2";

type MemoEvent = { type: string; minute: string | null; createdAt: Date; actorName: string };
type MemoAttachment = { name: string; mimeType: string; sizeBytes: number; sha256: string };
type MemoDecision = { purpose: string; outcome: string | null; note: string | null; decidedAt: Date | null; decidedBy: string | null };
type MemoPacketDocument = { name: string; mimeType: string; bytes: Buffer };

export type MemoOutputInput = {
  outputId: string;
  referenceNumber: string;
  classification: string;
  priority: string;
  status: string;
  subject: string;
  summary: string;
  body: string | null;
  senderReference: string | null;
  memoDate: Date;
  revisionVersion: number;
  originator: { name: string; position: string | null; office: string; department: string | null };
  routingNames: string[];
  generatedBy: string;
  generatedAt: Date;
  signaturePng?: Buffer | null;
  signatureProfileVersion: number;
  signatureSha256: string;
  events: MemoEvent[];
  attachments: MemoAttachment[];
  decisions: MemoDecision[];
  logoPng?: Buffer | null;
  includedDocuments?: MemoPacketDocument[];
  includeLifecycleEvidence?: boolean;
  draftPreview?: boolean;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

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
    if (line) lines.push(line);
    else if (!words.length) lines.push("");
  }
  return lines;
}

export async function renderMemoOutput(input: MemoOutputInput) {
  const document = await PDFDocument.create();
  document.setTitle(`${input.referenceNumber}: ${input.subject}`);
  document.setAuthor("Industrial Training Fund - ITF Flow");
  document.setSubject("Official correspondence lifecycle output");
  document.setCreator("ITF Flow");
  document.setProducer(`ITF Flow ${MEMO_TEMPLATE_VERSION}`);
  document.setCreationDate(input.generatedAt);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await document.embedFont(StandardFonts.HelveticaBoldOblique);
  const signature = input.signaturePng ? await document.embedPng(input.signaturePng) : null;
  const logo = input.logoPng ? await document.embedPng(input.logoPng) : null;
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage(title?: string) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    if (title) {
      page.drawText(printable(title), { x: MARGIN, y, size: 13, font: bold, color: rgb(0.42, 0.02, 0.08) });
      y -= 24;
    }
  }

  function ensure(height: number, title?: string) {
    if (y - height < 62) newPage(title);
  }

  function text(value: string, options: { size?: number; font?: PDFFont; indent?: number; gap?: number; color?: ReturnType<typeof rgb> } = {}) {
    const size = options.size ?? 9;
    const selectedFont = options.font ?? regular;
    const indent = options.indent ?? 0;
    const lines = wrap(value, selectedFont, size, PAGE_WIDTH - MARGIN * 2 - indent);
    for (const line of lines) {
      ensure(size + 3, "ITF memo output - continued");
      page.drawText(line, { x: MARGIN + indent, y, size, font: selectedFont, color: options.color ?? rgb(0.1, 0.1, 0.1) });
      y -= size + 3;
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
      const size = block.kind === "heading" ? 12 : 10;
      const indent = block.kind === "blockquote" ? 16 : block.kind === "list-item" ? 12 : 0;
      const maximumWidth = PAGE_WIDTH - MARGIN * 2 - indent;
      const sourceRuns: RichTextRun[] = block.prefix ? [{ text: block.prefix, bold: true }, ...block.runs] : block.runs;
      let line: { value: string; run: RichTextRun; font: PDFFont }[] = [];
      let lineWidth = 0;
      let pendingSpace: { run: RichTextRun; font: PDFFont } | null = null;
      const lines: typeof line[] = [];
      const flush = () => {
        lines.push(line);
        line = [];
        lineWidth = 0;
        pendingSpace = null;
      };
      for (const run of sourceRuns) {
        const font = runFont(run, block.kind === "heading");
        for (const part of printable(run.text).split(/(\n|\s+)/)) {
          if (!part) continue;
          if (part === "\n") {
            flush();
            continue;
          }
          if (/^\s+$/.test(part)) {
            if (line.length) pendingSpace = { run, font };
            continue;
          }
          const spaceWidth = pendingSpace ? pendingSpace.font.widthOfTextAtSize(" ", size) : 0;
          const wordWidth = font.widthOfTextAtSize(part, size);
          if (line.length && lineWidth + spaceWidth + wordWidth > maximumWidth) flush();
          if (pendingSpace && line.length) {
            line.push({ value: " ", run: pendingSpace.run, font: pendingSpace.font });
            lineWidth += pendingSpace.font.widthOfTextAtSize(" ", size);
          }
          line.push({ value: part, run, font });
          lineWidth += wordWidth;
          pendingSpace = null;
        }
      }
      if (line.length || !lines.length) flush();
      for (const renderedLine of lines) {
        ensure(size + 4, "ITF memo output - continued");
        let x = MARGIN + indent;
        for (const token of renderedLine) {
          page.drawText(token.value, { x, y, size, font: token.font, color: rgb(0.1, 0.1, 0.1) });
          const width = token.font.widthOfTextAtSize(token.value, size);
          if (token.run.underline && token.value.trim()) page.drawLine({ start: { x, y: y - 1 }, end: { x: x + width, y: y - 1 }, thickness: 0.55, color: rgb(0.1, 0.1, 0.1) });
          x += width;
        }
        y -= size + 4;
      }
      y -= block.kind === "heading" ? 7 : 5;
    }
  }

  function truncate(value: string, font: PDFFont, size: number, maximumWidth: number) {
    const normalized = printable(value);
    if (font.widthOfTextAtSize(normalized, size) <= maximumWidth) return normalized;
    let shortened = normalized;
    while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maximumWidth) shortened = shortened.slice(0, -1);
    return `${shortened}...`;
  }

  function headerRule(ruleY: number, thickness: number) {
    page.drawLine({ start: { x: 59, y: ruleY }, end: { x: PAGE_WIDTH - 76, y: ruleY }, thickness, color: rgb(0, 0, 0) });
  }

  function headerField(label: string, value: string, x: number, fieldY: number, maximumWidth: number) {
    const size = 9;
    page.drawText(label, { x, y: fieldY, size, font: bold, color: rgb(0, 0, 0) });
    const labelWidth = bold.widthOfTextAtSize(label, size) + 5;
    page.drawText(truncate(value, regular, size, maximumWidth - labelWidth), { x: x + labelWidth, y: fieldY, size, font: regular, color: rgb(0, 0, 0) });
  }

  const title = "INDUSTRIAL TRAINING FUND";
  const titleSize = 22;
  page.drawText(title, { x: (PAGE_WIDTH - bold.widthOfTextAtSize(title, titleSize)) / 2, y: 760, size: titleSize, font: bold, color: rgb(0, 0, 0) });
  const rawDepartment = input.originator.department ?? input.originator.office;
  const department = `${rawDepartment.toUpperCase()}${rawDepartment.toUpperCase().includes("DEPARTMENT") ? "" : " DEPARTMENT"}`;
  const departmentSize = 10;
  const departmentText = truncate(department, bold, departmentSize, PAGE_WIDTH - 120);
  page.drawText(departmentText, { x: (PAGE_WIDTH - bold.widthOfTextAtSize(departmentText, departmentSize)) / 2, y: 726, size: departmentSize, font: bold, color: rgb(0, 0, 0) });

  headerRule(715, 0.5);
  headerRule(710, 3);
  headerRule(705, 0.5);
  headerRule(619, 0.5);
  headerRule(614, 3);
  headerRule(609, 0.5);
  page.drawLine({ start: { x: 283, y: 619 }, end: { x: 283, y: 705 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: 288, y: 619 }, end: { x: 288, y: 705 }, thickness: 2.75, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: 292, y: 619 }, end: { x: 292, y: 705 }, thickness: 0.5, color: rgb(0, 0, 0) });
  if (logo) page.drawImage(logo, { x: 264, y: 639, width: 47, height: 47 });
  headerField("FROM:", input.originator.name, 72, 681, 183);
  headerField("REF:", input.senderReference || input.referenceNumber, 317, 681, 183);
  headerField("TO:", input.routingNames.length ? input.routingNames.join("; ") : "Official record", 72, 633, 183);
  headerField("DATE:", input.memoDate.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }), 324, 633, 176);

  const subject = truncate(input.subject.toUpperCase(), bold, 10, PAGE_WIDTH - 144);
  page.drawText(subject, { x: 72, y: 582, size: 10, font: bold, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: 72, y: 580 }, end: { x: 72 + bold.widthOfTextAtSize(subject, 10), y: 580 }, thickness: 0.7, color: rgb(0, 0, 0) });
  y = 556;
  if (input.body?.trim()) richText(input.body);
  else text(input.summary, { size: 10, gap: 14 });
  ensure(signature ? 125 : 62, "ITF memorandum - signature");
  if (signature) {
    const signatureWidth = 150;
    const signatureHeight = Math.min(55, signature.height * (signatureWidth / signature.width));
    page.drawImage(signature, { x: MARGIN, y: y - signatureHeight, width: signatureWidth, height: signatureHeight });
    y -= signatureHeight + 7;
  }
  text(input.originator.name, { font: bold, gap: 1 });
  text(`${input.originator.position ?? "Staff"} | ${input.originator.department ?? input.originator.office}`, { size: 8, gap: 1 });
  if (signature) text(`Authenticated self-service signature profile v${input.signatureProfileVersion} | SHA-256 ${input.signatureSha256.slice(0, 20)}...`, { size: 6.5, color: rgb(0.35, 0.35, 0.35) });

  for (const included of input.includedDocuments ?? []) {
    if (included.mimeType === "application/pdf") {
      const source = await PDFDocument.load(included.bytes, { updateMetadata: false });
      const copied = await document.copyPages(source, source.getPageIndices());
      copied.forEach((copiedPage) => document.addPage(copiedPage));
      continue;
    }
    if (included.mimeType === "image/jpeg" || included.mimeType === "image/png") {
      const image = included.mimeType === "image/jpeg" ? await document.embedJpg(included.bytes) : await document.embedPng(included.bytes);
      const imagePage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const imageMargin = 24;
      const scale = Math.min((PAGE_WIDTH - imageMargin * 2) / image.width, (PAGE_HEIGHT - imageMargin * 2) / image.height, 1);
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      imagePage.drawImage(image, { x: (PAGE_WIDTH - imageWidth) / 2, y: (PAGE_HEIGHT - imageHeight) / 2, width: imageWidth, height: imageHeight });
    }
  }

  if (input.includeLifecycleEvidence !== false) {
    newPage("CORRESPONDENCE LIFECYCLE EVIDENCE");
  text(`Output ID: ${input.outputId}`, { font: bold, gap: 1 });
  text(`Reference: ${input.referenceNumber} | Revision: ${input.revisionVersion} | Status: ${input.status} | Priority: ${input.priority}`, { size: 8, gap: 1 });
  text(`Generated: ${input.generatedAt.toISOString()} by ${input.generatedBy} | Template: ${MEMO_TEMPLATE_VERSION}`, { size: 8, gap: 12 });

  text("MOVEMENT AND MINUTES", { font: bold, size: 11, color: rgb(0.42, 0.02, 0.08) });
  for (const event of input.events) {
    text(`${event.createdAt.toISOString()} | ${event.type} | ${event.actorName}`, { font: bold, size: 7.5, gap: 1 });
    if (event.minute) text(event.minute, { size: 8, indent: 10, gap: 6 });
  }

  if (input.decisions.length) {
    text("DECISIONS", { font: bold, size: 11, color: rgb(0.42, 0.02, 0.08), gap: 8 });
    for (const decision of input.decisions) {
      text(`${decision.purpose}: ${decision.outcome ?? "PENDING"}${decision.decidedBy ? ` by ${decision.decidedBy}` : ""}${decision.decidedAt ? ` at ${decision.decidedAt.toISOString()}` : ""}`, { font: bold, size: 8, gap: 1 });
      if (decision.note) text(decision.note, { size: 8, indent: 10, gap: 6 });
    }
  }

  text("CONTROLLED DOCUMENT MANIFEST", { font: bold, size: 11, color: rgb(0.42, 0.02, 0.08), gap: 8 });
  if (!input.attachments.length) text("No included attachment at output time.", { size: 8 });
  for (const attachment of input.attachments) {
    text(`${attachment.name} | ${attachment.mimeType} | ${attachment.sizeBytes} bytes`, { font: bold, size: 7.5, gap: 1 });
    text(`SHA-256 ${attachment.sha256}`, { size: 6.5, indent: 10, gap: 6 });
  }
  }

  const pages = document.getPages();
  pages.forEach((item, index) => {
    if (input.draftPreview) item.drawText("DRAFT PREVIEW", { x: 105, y: 375, size: 54, font: bold, color: rgb(0.7, 0.7, 0.7), rotate: degrees(35), opacity: 0.22 });
    item.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: PAGE_WIDTH - MARGIN, y: 44 }, thickness: 0.5, color: rgb(0.65, 0.65, 0.65) });
    item.drawText(`ITF Flow controlled output | ${input.classification} | ${input.referenceNumber} | Page ${index + 1}/${pages.length}`, { x: MARGIN, y: 29, size: 6.5, font: regular, color: rgb(0.35, 0.35, 0.35) });
  });
  return Buffer.from(await document.save({ addDefaultPage: false, updateFieldAppearances: false, useObjectStreams: true }));
}
