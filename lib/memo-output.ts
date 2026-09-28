import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export const MEMO_TEMPLATE_VERSION = "ITF_MEMO_V2";

type MemoEvent = { type: string; minute: string | null; createdAt: Date; actorName: string };
type MemoAttachment = { name: string; mimeType: string; sizeBytes: number; sha256: string };
type MemoDecision = { purpose: string; outcome: string | null; note: string | null; decidedAt: Date | null; decidedBy: string | null };

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
  signaturePng: Buffer;
  signatureProfileVersion: number;
  signatureSha256: string;
  events: MemoEvent[];
  attachments: MemoAttachment[];
  decisions: MemoDecision[];
  logoPng?: Buffer | null;
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
  const signature = await document.embedPng(input.signaturePng);
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
  text(input.body?.trim() || input.summary, { size: 10, gap: 14 });
  ensure(125, "ITF memorandum - signature");
  const signatureWidth = 150;
  const signatureHeight = Math.min(55, signature.height * (signatureWidth / signature.width));
  page.drawImage(signature, { x: MARGIN, y: y - signatureHeight, width: signatureWidth, height: signatureHeight });
  y -= signatureHeight + 7;
  text(input.originator.name, { font: bold, gap: 1 });
  text(`${input.originator.position ?? "Staff"} | ${input.originator.department ?? input.originator.office}`, { size: 8, gap: 1 });
  text(`Authenticated self-service signature profile v${input.signatureProfileVersion} | SHA-256 ${input.signatureSha256.slice(0, 20)}...`, { size: 6.5, color: rgb(0.35, 0.35, 0.35) });

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

  const pages = document.getPages();
  pages.forEach((item, index) => {
    item.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: PAGE_WIDTH - MARGIN, y: 44 }, thickness: 0.5, color: rgb(0.65, 0.65, 0.65) });
    item.drawText(`ITF Flow controlled output | ${input.classification} | ${input.referenceNumber} | Page ${index + 1}/${pages.length}`, { x: MARGIN, y: 29, size: 6.5, font: regular, color: rgb(0.35, 0.35, 0.35) });
  });
  return Buffer.from(await document.save({ addDefaultPage: false, updateFieldAppearances: false, useObjectStreams: true }));
}
