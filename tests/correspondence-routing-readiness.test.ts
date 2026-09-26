import assert from "node:assert/strict";
import test from "node:test";
import { categoriesForDocumentType, routingPurposeHelp } from "../lib/correspondence-form";
import { directoryRecipientScope } from "../lib/directory-search";

const categories = [
  { code: "IN", name: "Incoming", correspondenceType: "INCOMING_LETTER", routineSlaDays: 10, urgentSlaDays: 5, immediateSlaDays: 2 },
  { code: "MEMO", name: "Memo", correspondenceType: "INTERNAL_MEMO", routineSlaDays: 7, urgentSlaDays: 3, immediateSlaDays: 1 },
];

test("workflow categories are limited to the selected document type", () => {
  assert.deepEqual(categoriesForDocumentType(categories, "INTERNAL_MEMO").map((item) => item.code), ["MEMO"]);
  assert.deepEqual(categoriesForDocumentType(categories, "OUTGOING_LETTER"), []);
});

test("copy search remains organization-wide while action search follows permitted routing", () => {
  assert.deepEqual(directoryRecipientScope({ mode: "copy", currentUserId: "actor", permittedActionIds: [] }), { id: { not: "actor" } });
  assert.deepEqual(directoryRecipientScope({ mode: "action", currentUserId: "actor", permittedActionIds: ["supervisor"] }), { id: { in: ["supervisor"], not: "actor" } });
  assert.deepEqual(directoryRecipientScope({ mode: "action", currentUserId: "admin", permittedActionIds: null }), { id: { not: "admin" } });
});

test("concurrence guidance distinguishes agreement from final approval", () => {
  assert.match(routingPurposeHelp.CONCURRENCE, /formally agrees/);
  assert.match(routingPurposeHelp.CONCURRENCE, /not final approval/);
});
