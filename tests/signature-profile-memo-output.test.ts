import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { MEMO_TEMPLATE_VERSION, renderMemoOutput } from "../lib/memo-output";
import { assertSignatureImageDecodable, validateSignatureImage } from "../lib/signature-profile";

const png = readFileSync(new URL("../public/itf-logo.png", import.meta.url));

test("signature profile validation accepts a bounded decodable PNG and records its digest", async () => {
  const result = validateSignatureImage(png, "image/png");
  await assertSignatureImageDecodable(png);
  assert.ok(result.width >= 10);
  assert.ok(result.height >= 10);
  assert.equal(result.sizeBytes, png.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("signature profile validation rejects the wrong declared type and undersized headers", () => {
  assert.throws(() => validateSignatureImage(png, "image/jpeg"), /valid PNG/);
  assert.throws(() => validateSignatureImage(Buffer.from("not a png"), "image/png"), /valid PNG/);
});

test("governed memo output renders a parseable lifecycle PDF", async () => {
  const generated = await renderMemoOutput({
    outputId: "output-test-1",
    referenceNumber: "ITF/FLOW/2026/00001",
    classification: "INTERNAL",
    priority: "ROUTINE",
    status: "RESOLVED",
    subject: "Implementation status memorandum",
    summary: "A controlled summary of the completed work.",
    body: "Management is invited to note that the assigned action has been completed and recorded in ITF Flow.",
    senderReference: "ITF/ICT/2026/01",
    receivedAt: new Date("2026-09-28T08:00:00.000Z"),
    revisionVersion: 3,
    originator: { name: "Ada Officer", position: "Programme Officer", office: "ICT", department: "Information Technology" },
    routingNames: ["Director ICT", "Director Administration"],
    generatedBy: "Records Administrator",
    generatedAt: new Date("2026-09-28T10:00:00.000Z"),
    signaturePng: png,
    signatureProfileVersion: 2,
    signatureSha256: validateSignatureImage(png, "image/png").sha256,
    events: [
      { type: "SUBMITTED", minute: "Submitted for action.", createdAt: new Date("2026-09-28T08:00:00.000Z"), actorName: "Ada Officer" },
      { type: "RESOLVED", minute: "Required work completed.", createdAt: new Date("2026-09-28T09:30:00.000Z"), actorName: "Director ICT" },
    ],
    attachments: [{ name: "supporting-note.pdf", mimeType: "application/pdf", sizeBytes: 1234, sha256: "a".repeat(64) }],
    decisions: [{ purpose: "APPROVAL", outcome: "APPROVED", note: "Approved for implementation.", decidedAt: new Date("2026-09-28T09:00:00.000Z"), decidedBy: "Director ICT" }],
    logoPng: png,
  });
  const pdf = await PDFDocument.load(generated);
  assert.ok(pdf.getPageCount() >= 2);
  assert.equal(pdf.getCreator(), "ITF Flow");
  assert.ok(MEMO_TEMPLATE_VERSION.startsWith("ITF_MEMO_"));
  assert.match(pdf.getTitle() ?? "", /ITF\/FLOW\/2026\/00001/);
});
