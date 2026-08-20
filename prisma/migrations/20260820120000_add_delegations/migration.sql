CREATE TYPE "DelegationKind" AS ENUM ('DELEGATION', 'ACTING_APPOINTMENT');
CREATE TYPE "DelegationStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "DelegationEventType" AS ENUM ('CREATED', 'REVOKED');

ALTER TYPE "NotificationType" ADD VALUE 'DELEGATION_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'DELEGATION_REVOKED';

CREATE TABLE "Delegation" (
  "id" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "delegateId" TEXT NOT NULL,
  "kind" "DelegationKind" NOT NULL,
  "status" "DelegationStatus" NOT NULL DEFAULT 'ACTIVE',
  "officeLabel" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "canApprove" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DelegationEvent" (
  "id" TEXT NOT NULL,
  "delegationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "DelegationEventType" NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DelegationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Delegation_delegateId_status_startsAt_endsAt_idx" ON "Delegation"("delegateId", "status", "startsAt", "endsAt");
CREATE INDEX "Delegation_principalId_status_startsAt_endsAt_idx" ON "Delegation"("principalId", "status", "startsAt", "endsAt");
CREATE INDEX "DelegationEvent_delegationId_createdAt_idx" ON "DelegationEvent"("delegationId", "createdAt");
CREATE INDEX "DelegationEvent_actorId_createdAt_idx" ON "DelegationEvent"("actorId", "createdAt");
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DelegationEvent" ADD CONSTRAINT "DelegationEvent_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DelegationEvent" ADD CONSTRAINT "DelegationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
