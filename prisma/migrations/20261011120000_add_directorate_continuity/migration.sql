ALTER TYPE "RecipientKind" ADD VALUE 'OVERSIGHT';

CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

CREATE TABLE "DirectorateContinuityPlan" (
    "id" TEXT NOT NULL,
    "departmentKey" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "directorId" TEXT NOT NULL,
    "firstSuccessorId" TEXT NOT NULL,
    "secondSuccessorId" TEXT NOT NULL,
    "firstCanApprove" BOOLEAN NOT NULL DEFAULT false,
    "secondCanApprove" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "configuredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DirectorateContinuityPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAvailability" (
    "userId" TEXT NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "reason" TEXT,
    "unavailableUntil" TIMESTAMP(3),
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "StaffAvailabilityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "unavailableUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffAvailabilityEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkItem"
ADD COLUMN "authorityPrincipalId" TEXT,
ADD COLUMN "continuityPlanId" TEXT,
ADD COLUMN "continuityRank" INTEGER,
ADD COLUMN "continuityCanApprove" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "DirectorateContinuityPlan_departmentKey_key" ON "DirectorateContinuityPlan"("departmentKey");
CREATE UNIQUE INDEX "DirectorateContinuityPlan_directorId_key" ON "DirectorateContinuityPlan"("directorId");
CREATE INDEX "DirectorateContinuityPlan_isActive_departmentName_idx" ON "DirectorateContinuityPlan"("isActive", "departmentName");
CREATE INDEX "DirectorateContinuityPlan_firstSuccessorId_isActive_idx" ON "DirectorateContinuityPlan"("firstSuccessorId", "isActive");
CREATE INDEX "DirectorateContinuityPlan_secondSuccessorId_isActive_idx" ON "DirectorateContinuityPlan"("secondSuccessorId", "isActive");
CREATE INDEX "StaffAvailability_status_unavailableUntil_idx" ON "StaffAvailability"("status", "unavailableUntil");
CREATE INDEX "StaffAvailabilityEvent_userId_createdAt_idx" ON "StaffAvailabilityEvent"("userId", "createdAt");
CREATE INDEX "StaffAvailabilityEvent_actorId_createdAt_idx" ON "StaffAvailabilityEvent"("actorId", "createdAt");
CREATE INDEX "WorkItem_continuityPlanId_status_idx" ON "WorkItem"("continuityPlanId", "status");
CREATE INDEX "WorkItem_authorityPrincipalId_status_idx" ON "WorkItem"("authorityPrincipalId", "status");

ALTER TABLE "DirectorateContinuityPlan" ADD CONSTRAINT "DirectorateContinuityPlan_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectorateContinuityPlan" ADD CONSTRAINT "DirectorateContinuityPlan_firstSuccessorId_fkey" FOREIGN KEY ("firstSuccessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectorateContinuityPlan" ADD CONSTRAINT "DirectorateContinuityPlan_secondSuccessorId_fkey" FOREIGN KEY ("secondSuccessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectorateContinuityPlan" ADD CONSTRAINT "DirectorateContinuityPlan_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffAvailabilityEvent" ADD CONSTRAINT "StaffAvailabilityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAvailabilityEvent" ADD CONSTRAINT "StaffAvailabilityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_authorityPrincipalId_fkey" FOREIGN KEY ("authorityPrincipalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_continuityPlanId_fkey" FOREIGN KEY ("continuityPlanId") REFERENCES "DirectorateContinuityPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
