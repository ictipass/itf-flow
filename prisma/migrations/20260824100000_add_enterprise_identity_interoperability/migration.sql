CREATE TYPE "StaffAuthenticationMethod" AS ENUM ('LOCAL_PASSWORD','WORKSPACE_LAUNCH','ENTERPRISE_OIDC');
CREATE TYPE "IntegrationEventType" AS ENUM ('SESSION_CREATED','SESSION_REVOKED','CENTRAL_LOGOUT','ENTITLEMENT_REVOKED','DIRECTORY_SYNCHRONIZED','ATTENTION_QUERIED');

CREATE TABLE "StaffSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "authenticationMethod" "StaffAuthenticationMethod" NOT NULL,
  "identityProvider" TEXT,
  "workspaceSessionId" TEXT,
  "mfaAuthenticatedAt" TIMESTAMP(3),
  "stepUpUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "type" "IntegrationEventType" NOT NULL,
  "userId" TEXT,
  "workspaceUserId" TEXT,
  "sessionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffSession_userId_revokedAt_expiresAt_idx" ON "StaffSession"("userId","revokedAt","expiresAt");
CREATE INDEX "StaffSession_workspaceSessionId_idx" ON "StaffSession"("workspaceSessionId");
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");
CREATE UNIQUE INDEX "IntegrationEvent_eventId_key" ON "IntegrationEvent"("eventId");
CREATE INDEX "IntegrationEvent_correlationId_createdAt_idx" ON "IntegrationEvent"("correlationId","createdAt");
CREATE INDEX "IntegrationEvent_workspaceUserId_createdAt_idx" ON "IntegrationEvent"("workspaceUserId","createdAt");
CREATE INDEX "IntegrationEvent_type_createdAt_idx" ON "IntegrationEvent"("type","createdAt");
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
