import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { itfLogoPng } from "../lib/itf-branding";
import { OUTGOING_LETTER_TEMPLATE_VERSION, renderOutgoingLetter } from "../lib/outgoing-letter-output";

test("departmental outgoing letter produces a controlled PDF preview", async () => {
  const bytes = await renderOutgoingLetter({
    referenceNumber: "ITF/ICT/2026/001",
    classification: "INTERNAL",
    subject: "Invitation to stakeholder review",
    summary: "Invitation to the stakeholder review session.",
    body: "<p>Please attend the <strong>stakeholder review</strong> session.</p><ul><li>Bring the implementation report</li></ul>",
    letterDate: new Date("2026-11-02T09:00:00.000Z"),
    departmentName: "Information and Communication Technology",
    departmentEmail: "ict@itf-nigeria.com",
    addressLines: ["Headquarters Office Complex", "Miango Road", "P.M.B. 2199", "Jos, Plateau State", "NIGERIA"],
    recipient: { name: "The Managing Director", organization: "Example Limited", email: "md@example.org", address: "1 Example Road, Abuja" },
    director: { name: "Example Director" },
    generatedAt: new Date("2026-11-02T09:00:00.000Z"),
    logoPng: await itfLogoPng(),
    draftPreview: true,
  });
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), "ITF/ICT/2026/001: Invitation to stakeholder review");
  assert.equal(pdf.getCreator(), "ITF Flow");
  assert.equal(OUTGOING_LETTER_TEMPLATE_VERSION, "ITF_DEPARTMENT_LETTERHEAD_V1");
});

test("final outgoing letter accepts the Director visual signature", async () => {
  const bytes = await renderOutgoingLetter({
    referenceNumber: "ITF/AHRD/2026/002",
    classification: "PUBLIC",
    subject: "Official response",
    summary: "Official response.",
    body: "<p>This is our official response.</p>",
    letterDate: new Date("2026-11-02T09:00:00.000Z"),
    departmentName: "Administration and Human Resource Management Department",
    departmentEmail: "ahrd@itf.gov.ng",
    addressLines: ["Headquarters Office Complex", "Jos, Nigeria"],
    recipient: { name: "The Permanent Secretary", email: "ps@example.gov.ng", address: "Federal Secretariat, Abuja" },
    director: { name: "A. Director", signaturePng: await itfLogoPng() },
    finalizedBy: "Acting Officer",
    generatedAt: new Date("2026-11-02T09:00:00.000Z"),
    logoPng: await itfLogoPng(),
  });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(bytes.length > 2_000);
});
