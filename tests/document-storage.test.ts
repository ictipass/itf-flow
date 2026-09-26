import assert from "node:assert/strict";
import test from "node:test";
import { documentProvider } from "../lib/document-storage";

test("document storage selects local and private Vercel Blob providers explicitly", () => {
  assert.equal(documentProvider("LOCAL").name, "LOCAL");
  assert.equal(documentProvider("vercel_blob").name, "VERCEL_BLOB");
});

test("document storage fails closed for unknown providers", () => {
  assert.throws(() => documentProvider("UNKNOWN"), /Unsupported document storage provider/);
});
