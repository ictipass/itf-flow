CREATE TYPE "AssuranceStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'BLOCKED', 'WAIVED');
CREATE TYPE "AssuranceCategory" AS ENUM ('SECURITY', 'RELIABILITY', 'PERFORMANCE', 'OPERATIONS', 'GOVERNANCE', 'PILOT');

CREATE TABLE "AssuranceCheck" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "category" "AssuranceCategory" NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT NOT NULL, "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "AssuranceStatus" NOT NULL DEFAULT 'PENDING', "evidence" TEXT, "owner" TEXT,
  "reviewedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssuranceCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssuranceCheck_key_key" ON "AssuranceCheck"("key");
CREATE INDEX "AssuranceCheck_category_status_idx" ON "AssuranceCheck"("category", "status");
CREATE INDEX "AssuranceCheck_required_status_idx" ON "AssuranceCheck"("required", "status");
ALTER TABLE "AssuranceCheck" ADD CONSTRAINT "AssuranceCheck_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OperationalEvent" (
  "id" TEXT NOT NULL, "severity" TEXT NOT NULL, "component" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL, "correlationId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationalEvent_severity_createdAt_idx" ON "OperationalEvent"("severity", "createdAt");
CREATE INDEX "OperationalEvent_component_createdAt_idx" ON "OperationalEvent"("component", "createdAt");
CREATE INDEX "OperationalEvent_correlationId_idx" ON "OperationalEvent"("correlationId");

INSERT INTO "AssuranceCheck" ("id", "key", "category", "title", "description", "status", "updatedAt") VALUES
('s26-authz', 'authorization-regression', 'SECURITY', 'Authorization regression', 'Role, classification, delegation and need-to-know boundaries are regression tested.', 'PENDING', CURRENT_TIMESTAMP),
('s26-pentest', 'penetration-test', 'SECURITY', 'Independent penetration test', 'Independent security testing is complete and findings are closed.', 'PENDING', CURRENT_TIMESTAMP),
('s26-edms', 'document-security', 'SECURITY', 'Production document security', 'Real EDMS, malware scanner and OCR adapters pass integration and security testing.', 'BLOCKED', CURRENT_TIMESTAMP),
('s26-load', 'load-test', 'PERFORMANCE', 'Production-like load test', 'Expected concurrency, uploads and largest records meet agreed thresholds.', 'PENDING', CURRENT_TIMESTAMP),
('s26-restore', 'backup-restore', 'RELIABILITY', 'Backup and restore drill', 'Database and document backups are restored into an isolated environment and reconciled.', 'PENDING', CURRENT_TIMESTAMP),
('s26-dr', 'disaster-recovery', 'RELIABILITY', 'Disaster recovery exercise', 'Recovery objectives, failover, contacts and rollback are exercised.', 'PENDING', CURRENT_TIMESTAMP),
('s26-monitoring', 'monitoring-alerting', 'OPERATIONS', 'Monitoring and alerting', 'Production telemetry, alert routes, retention and on-call ownership are verified.', 'PENDING', CURRENT_TIMESTAMP),
('s26-accessibility', 'accessibility', 'GOVERNANCE', 'Accessibility review', 'Core journeys meet the approved accessibility standard.', 'PENDING', CURRENT_TIMESTAMP),
('s26-governance', 'data-governance', 'GOVERNANCE', 'Data governance approval', 'Retention, classification, privacy and records-management owners approve operation.', 'PENDING', CURRENT_TIMESTAMP),
('s26-pilot', 'controlled-pilot', 'PILOT', 'Controlled pilot', 'Named pilot groups complete training and agreed success measures are accepted.', 'PENDING', CURRENT_TIMESTAMP),
('s26-signoff', 'production-signoff', 'PILOT', 'Production sign-off', 'Business, ICT, security and records owners approve production release.', 'PENDING', CURRENT_TIMESTAMP);
