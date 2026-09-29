import assert from "node:assert/strict";
import test from "node:test";
import { assertDocumentConverterConfiguration, documentConverterProvider } from "../lib/document-conversion";
import { normalizeRichTextForStorage, richTextBlocks, richTextHtml, richTextPlainText } from "../lib/rich-text";
import { memoPacketIncludedAttachmentIds } from "../lib/memo-packet-metadata";

test("rich memo content is sanitized while preserving approved formatting", () => {
  const stored = normalizeRichTextForStorage('<h2 onclick="attack()">Heading</h2><p>Hello <strong>team</strong> <script>bad()</script><em>today</em>.</p>');
  assert.ok(stored);
  const html = richTextHtml(stored);
  assert.equal(html, "<h2>Heading</h2><p>Hello <strong>team</strong> <em>today</em>.</p>");
  assert.equal(richTextPlainText(stored), "Heading\nHello team today.");
  const blocks = richTextBlocks(stored);
  assert.equal(blocks[0].kind, "heading");
  assert.equal(blocks[1].runs.some((run) => run.bold && run.text === "team"), true);
  assert.equal(blocks[1].runs.some((run) => run.italic && run.text === "today"), true);
});

test("memo packet metadata identifies source attachments already represented in the packet", () => {
  assert.deepEqual(memoPacketIncludedAttachmentIds([
    { metadata: { sourceAttachmentId: "old" } },
    { metadata: { includedAttachmentIds: ["pdf-1", 4, "image-2"] } },
  ]), ["pdf-1", "image-2"]);
});

test("Office conversion is explicit and validates the Gotenberg endpoint", () => {
  assert.equal(documentConverterProvider({} as NodeJS.ProcessEnv), "DISABLED");
  assert.throws(() => assertDocumentConverterConfiguration({ DOCUMENT_CONVERTER_PROVIDER: "DISABLED" } as unknown as NodeJS.ProcessEnv), /not configured/);
  assert.throws(() => assertDocumentConverterConfiguration({ DOCUMENT_CONVERTER_PROVIDER: "GOTENBERG" } as unknown as NodeJS.ProcessEnv), /GOTENBERG_URL/);
  assert.doesNotThrow(() => assertDocumentConverterConfiguration({ DOCUMENT_CONVERTER_PROVIDER: "GOTENBERG", GOTENBERG_URL: "https://documents.example.test" } as unknown as NodeJS.ProcessEnv));
});
