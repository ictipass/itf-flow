CREATE TYPE "NotificationType" AS ENUM ('ASSIGNED', 'COPIED', 'RETURNED', 'PEER_REFERRED', 'DECISION_REQUESTED', 'DECISION_RECORDED', 'REVISION_CREATED', 'BROADCAST_PUBLISHED', 'DISPATCH_FAILED');
CREATE TYPE "EmailOutboxStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER');

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "actorId" TEXT, "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL, "message" TEXT NOT NULL, "href" TEXT NOT NULL, "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL, "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_userId_sourceType_sourceId_type_key" ON "Notification"("userId", "sourceType", "sourceId", "type");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailOutbox" (
  "id" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "userId" TEXT, "toAddress" TEXT NOT NULL,
  "subject" TEXT NOT NULL, "textBody" TEXT NOT NULL, "status" "EmailOutboxStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3), "sentAt" TIMESTAMP(3),
  "lastErrorCode" TEXT, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailOutbox_idempotencyKey_key" ON "EmailOutbox"("idempotencyKey");
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");
CREATE INDEX "EmailOutbox_sourceType_sourceId_idx" ON "EmailOutbox"("sourceType", "sourceId");

CREATE TABLE "EmailDeliveryAttempt" (
  "id" TEXT NOT NULL, "outboxId" TEXT NOT NULL, "attempt" INTEGER NOT NULL, "successful" BOOLEAN NOT NULL,
  "errorCode" TEXT, "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDeliveryAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailDeliveryAttempt_outboxId_attempt_key" ON "EmailDeliveryAttempt"("outboxId", "attempt");
CREATE INDEX "EmailDeliveryAttempt_attemptedAt_idx" ON "EmailDeliveryAttempt"("attemptedAt");
ALTER TABLE "EmailDeliveryAttempt" ADD CONSTRAINT "EmailDeliveryAttempt_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "EmailOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
