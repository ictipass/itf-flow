CREATE TYPE "DispatchChannel" AS ENUM ('OFFICIAL_EMAIL', 'PHYSICAL_DELIVERY', 'COURIER', 'STAKEHOLDER_PORTAL');
CREATE TYPE "DispatchStatus" AS ENUM ('PREPARED', 'DISPATCHED', 'DELIVERED', 'FAILED');

ALTER TYPE "EventType" ADD VALUE 'DISPATCH_PREPARED' AFTER 'REVISED';
ALTER TYPE "EventType" ADD VALUE 'DISPATCHED' AFTER 'DISPATCH_PREPARED';
ALTER TYPE "EventType" ADD VALUE 'DELIVERY_CONFIRMED' AFTER 'DISPATCHED';
ALTER TYPE "EventType" ADD VALUE 'DELIVERY_FAILED' AFTER 'DELIVERY_CONFIRMED';

ALTER TABLE "Correspondence" ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Correspondence" correspondence SET "requiresApproval" = true
WHERE EXISTS (SELECT 1 FROM "DecisionRequest" decision WHERE decision."correspondenceId" = correspondence."id" AND decision."purpose" = 'APPROVAL');

CREATE TABLE "DispatchRecord" (
  "id" TEXT NOT NULL,
  "correspondenceId" TEXT NOT NULL,
  "outgoingReference" TEXT NOT NULL,
  "channel" "DispatchChannel" NOT NULL,
  "status" "DispatchStatus" NOT NULL DEFAULT 'PREPARED',
  "recipientName" TEXT NOT NULL,
  "recipientOrganization" TEXT,
  "recipientEmail" TEXT,
  "recipientAddress" TEXT,
  "trackingNumber" TEXT,
  "dispatchNote" TEXT,
  "deliveryNote" TEXT,
  "createdById" TEXT NOT NULL,
  "dispatchedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DispatchRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispatchRecord_outgoingReference_key" ON "DispatchRecord"("outgoingReference");
CREATE INDEX "DispatchRecord_correspondenceId_createdAt_idx" ON "DispatchRecord"("correspondenceId", "createdAt");
CREATE INDEX "DispatchRecord_status_createdAt_idx" ON "DispatchRecord"("status", "createdAt");
ALTER TABLE "DispatchRecord" ADD CONSTRAINT "DispatchRecord_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchRecord" ADD CONSTRAINT "DispatchRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
