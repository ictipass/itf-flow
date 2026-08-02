CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN', 'EXPIRED');
CREATE TYPE "BroadcastCategory" AS ENUM ('GENERAL', 'HUMAN_RESOURCES', 'POLICY', 'EMERGENCY', 'SYSTEM');
CREATE TYPE "BroadcastPriority" AS ENUM ('ROUTINE', 'IMPORTANT', 'URGENT');
CREATE TYPE "BroadcastScopeType" AS ENUM ('ORGANIZATION', 'OFFICE', 'DEPARTMENT', 'DIVISION', 'UNIT', 'ROLE', 'USER');
CREATE TYPE "BroadcastEventType" AS ENUM ('DRAFTED', 'PUBLISHED', 'READ', 'ACKNOWLEDGED', 'WITHDRAWN');

CREATE TABLE "BroadcastPublisherGrant" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "scopeType" "BroadcastScopeType" NOT NULL,
  "scopeValue" TEXT, "allowedCategories" "BroadcastCategory"[],
  "canRequireAcknowledgement" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BroadcastPublisherGrant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Broadcast" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "message" TEXT NOT NULL,
  "category" "BroadcastCategory" NOT NULL, "priority" "BroadcastPriority" NOT NULL DEFAULT 'ROUTINE',
  "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT', "mandatoryAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL, "publishedById" TEXT, "publishAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3), "withdrawnAt" TIMESTAMP(3), "withdrawalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BroadcastAudience" (
  "id" TEXT NOT NULL, "broadcastId" TEXT NOT NULL, "scopeType" "BroadcastScopeType" NOT NULL,
  "scopeValue" TEXT, "label" TEXT NOT NULL, CONSTRAINT "BroadcastAudience_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BroadcastRecipient" (
  "id" TEXT NOT NULL, "broadcastId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL, "recipientEmail" TEXT NOT NULL, "recipientRole" TEXT NOT NULL,
  "recipientOffice" TEXT NOT NULL, "recipientDepartment" TEXT, "recipientDivision" TEXT, "recipientUnit" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3), "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BroadcastEvent" (
  "id" TEXT NOT NULL, "broadcastId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "type" "BroadcastEventType" NOT NULL, "detail" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BroadcastEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BroadcastPublisherGrant_userId_scopeType_scopeValue_key" ON "BroadcastPublisherGrant"("userId", "scopeType", "scopeValue");
CREATE INDEX "BroadcastPublisherGrant_userId_isActive_idx" ON "BroadcastPublisherGrant"("userId", "isActive");
CREATE INDEX "Broadcast_status_publishAt_expiresAt_idx" ON "Broadcast"("status", "publishAt", "expiresAt");
CREATE INDEX "Broadcast_createdById_createdAt_idx" ON "Broadcast"("createdById", "createdAt");
CREATE INDEX "BroadcastAudience_broadcastId_idx" ON "BroadcastAudience"("broadcastId");
CREATE UNIQUE INDEX "BroadcastRecipient_broadcastId_userId_key" ON "BroadcastRecipient"("broadcastId", "userId");
CREATE INDEX "BroadcastRecipient_userId_readAt_acknowledgedAt_idx" ON "BroadcastRecipient"("userId", "readAt", "acknowledgedAt");
CREATE INDEX "BroadcastEvent_broadcastId_createdAt_idx" ON "BroadcastEvent"("broadcastId", "createdAt");
CREATE INDEX "BroadcastEvent_actorId_createdAt_idx" ON "BroadcastEvent"("actorId", "createdAt");

ALTER TABLE "BroadcastPublisherGrant" ADD CONSTRAINT "BroadcastPublisherGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BroadcastAudience" ADD CONSTRAINT "BroadcastAudience_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BroadcastEvent" ADD CONSTRAINT "BroadcastEvent_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BroadcastEvent" ADD CONSTRAINT "BroadcastEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
