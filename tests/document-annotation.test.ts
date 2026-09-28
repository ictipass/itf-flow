import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { annotateDocument, isAnnotatableDocument } from "../lib/document-annotation";
import { annotationInputMethod, parseAnnotationInk } from "../lib/annotation-ink";
import { signApprovalPayload, verifyCanonicalSignature } from "../lib/approval-signatures";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
  "base64",
);

async function twoPagePdf() {
  const document = await PDFDocument.create();
  document.addPage([595, 842]);
  document.addPage([595, 842]);
  return Buffer.from(await document.save());
}

test("PDF annotation creates a new parseable PDF without changing the source bytes", async () => {
  const source = await twoPagePdf();
  const original = Buffer.from(source);
  const result = await annotateDocument({
    source,
    mimeType: "application/pdf",
    pageNumber: 2,
    placement: "TOP_RIGHT",
    minuteText: "Please review and advise the Director by close of work.",
    signerName: "Ada Officer",
    signerRole: "OFFICER",
    signerPosition: "Programme Officer",
    signedAt: new Date("2026-09-27T12:00:00.000Z"),
  });
  assert.deepEqual(source, original);
  assert.notDeepEqual(result.bytes, source);
  assert.equal(result.pageCount, 2);
  const annotated = await PDFDocument.load(result.bytes);
  assert.equal(annotated.getPageCount(), 2);
});

test("annotation rejects an out-of-range page", async () => {
  await assert.rejects(
    annotateDocument({
      source: await twoPagePdf(),
      mimeType: "application/pdf",
      pageNumber: 3,
      placement: "BOTTOM_LEFT",
      minuteText: "Action this request.",
      signerName: "Ada Officer",
      signerRole: "OFFICER",
      signedAt: new Date("2026-09-27T12:00:00.000Z"),
    }),
    /between 1 and 2/,
  );
});

test("stylus ink is embedded into the selected PDF page", async () => {
  const source = await twoPagePdf();
  const result = await annotateDocument({
    source,
    mimeType: "application/pdf",
    pageNumber: 1,
    placement: "BOTTOM_RIGHT",
    minuteText: "Handwritten in-document annotation and signature.",
    inkPng: onePixelPng,
    signerName: "Director Test",
    signerRole: "DIRECTOR",
    signedAt: new Date("2026-09-28T09:00:00.000Z"),
  });
  assert.notDeepEqual(result.bytes, source);
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 2);
});

test("annotation input accepts typed text, stylus ink, or both and rejects an empty submission", () => {
  const dataUrl = `data:image/png;base64,${onePixelPng.toString("base64")}`;
  const ink = parseAnnotationInk(dataUrl);
  assert.deepEqual(ink, onePixelPng);
  assert.equal(annotationInputMethod("Please action this.", null), "TEXT");
  assert.equal(annotationInputMethod("", ink), "INK");
  assert.equal(annotationInputMethod("Please action this.", ink), "TEXT_AND_INK");
  assert.throws(() => annotationInputMethod("", null), /typed minute or write directly/);
  assert.throws(() => parseAnnotationInk("data:image/jpeg;base64,AAAA"), /PNG drawing/);
});

test("PDF and scanned image formats are annotatable while Office formats remain out of scope", () => {
  assert.equal(isAnnotatableDocument("application/pdf"), true);
  assert.equal(isAnnotatableDocument("image/jpeg"), true);
  assert.equal(isAnnotatableDocument("image/png"), true);
  assert.equal(isAnnotatableDocument("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), false);
  assert.equal(isAnnotatableDocument("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), false);
});

test("annotation audit payload signatures fail closed after tampering", () => {
  const canonicalPayload = { schema: "ITF_FLOW_DOCUMENT_ANNOTATION_V1", outputSha256: "abc", minuteText: "Act on this." };
  const signatureValue = signApprovalPayload(canonicalPayload);
  assert.equal(verifyCanonicalSignature({ canonicalPayload, signatureValue }), true);
  assert.equal(verifyCanonicalSignature({ canonicalPayload: { ...canonicalPayload, minuteText: "Altered" }, signatureValue }), false);
  assert.equal(verifyCanonicalSignature({ canonicalPayload, signatureValue: "not-a-signature" }), false);
});
