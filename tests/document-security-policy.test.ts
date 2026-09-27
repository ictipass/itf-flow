import assert from "node:assert/strict";
import test from "node:test";
import { DocumentEventType, DocumentProcessingStatus, MalwareScanStatus } from "../lib/generated/prisma/client";
import {
  attachmentPassesDocumentSecurityGate,
  initialDocumentEvent,
  initialDocumentSecurityState,
  malwareScannerMode,
} from "../lib/document-security";

test("malware scanner defaults to fail-closed enabled mode", () => {
  assert.equal(malwareScannerMode({} as NodeJS.ProcessEnv), "ENABLED");
  assert.equal(malwareScannerMode({ MALWARE_SCANNER: " disabled " } as unknown as NodeJS.ProcessEnv), "DISABLED");
  assert.throws(() => malwareScannerMode({ MALWARE_SCANNER: "sometimes" } as unknown as NodeJS.ProcessEnv), /ENABLED or DISABLED/);
});

test("disabled scanner creates an auditable immediately available state", () => {
  assert.deepEqual(initialDocumentSecurityState("DISABLED"), {
    malwareScanStatus: MalwareScanStatus.BYPASSED,
    processingStatus: DocumentProcessingStatus.AVAILABLE,
  });
  const event = initialDocumentEvent("DISABLED", "Staff upload");
  assert.equal(event.type, DocumentEventType.SCAN_BYPASSED);
  assert.match(event.detail, /MALWARE_SCANNER=DISABLED/);
});

test("enabled scanner preserves quarantine until a clean result", () => {
  assert.deepEqual(initialDocumentSecurityState("ENABLED"), {
    malwareScanStatus: MalwareScanStatus.PENDING,
    processingStatus: DocumentProcessingStatus.QUARANTINED,
  });
  assert.equal(attachmentPassesDocumentSecurityGate({ processingStatus: DocumentProcessingStatus.QUARANTINED, malwareScanStatus: MalwareScanStatus.PENDING }), false);
  assert.equal(attachmentPassesDocumentSecurityGate({ processingStatus: DocumentProcessingStatus.AVAILABLE, malwareScanStatus: MalwareScanStatus.CLEAN }), true);
  assert.equal(attachmentPassesDocumentSecurityGate({ processingStatus: DocumentProcessingStatus.AVAILABLE, malwareScanStatus: MalwareScanStatus.BYPASSED }), true);
  assert.equal(attachmentPassesDocumentSecurityGate({ processingStatus: DocumentProcessingStatus.AVAILABLE, malwareScanStatus: MalwareScanStatus.NOT_SCANNED }), false);
});
