import { DocumentEventType, DocumentProcessingStatus, MalwareScanStatus } from "@/lib/generated/prisma/client";

export type MalwareScannerMode = "ENABLED" | "DISABLED";

export function malwareScannerMode(environment: NodeJS.ProcessEnv = process.env): MalwareScannerMode {
  const value = (environment.MALWARE_SCANNER ?? "ENABLED").trim().toUpperCase();
  if (value === "ENABLED" || value === "DISABLED") return value;
  throw new Error("MALWARE_SCANNER must be either ENABLED or DISABLED.");
}

export function malwareScannerEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return malwareScannerMode(environment) === "ENABLED";
}

export function initialDocumentSecurityState(mode: MalwareScannerMode) {
  return mode === "DISABLED"
    ? {
        malwareScanStatus: MalwareScanStatus.BYPASSED,
        processingStatus: DocumentProcessingStatus.AVAILABLE,
      }
    : {
        malwareScanStatus: MalwareScanStatus.PENDING,
        processingStatus: DocumentProcessingStatus.QUARANTINED,
      };
}

export function initialDocumentEvent(mode: MalwareScannerMode, source: string) {
  return mode === "DISABLED"
    ? {
        type: DocumentEventType.SCAN_BYPASSED,
        detail: `${source} released without malware scanning because MALWARE_SCANNER=DISABLED.`,
        metadata: { scannerMode: mode },
      }
    : {
        type: DocumentEventType.QUARANTINED,
        detail: `${source} stored in quarantine.`,
        metadata: { scannerMode: mode },
      };
}

export function malwareStatusAllowsUse(status: MalwareScanStatus) {
  return status === MalwareScanStatus.CLEAN || status === MalwareScanStatus.BYPASSED;
}

export function attachmentPassesDocumentSecurityGate(attachment: {
  processingStatus: DocumentProcessingStatus;
  malwareScanStatus: MalwareScanStatus;
}) {
  return attachment.processingStatus === DocumentProcessingStatus.AVAILABLE && malwareStatusAllowsUse(attachment.malwareScanStatus);
}
