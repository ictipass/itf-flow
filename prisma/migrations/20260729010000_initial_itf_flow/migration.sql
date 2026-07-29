-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DG_SECRETARY', 'DG', 'DIRECTOR', 'DIVISION_HEAD', 'UNIT_HEAD', 'OFFICER', 'RECORDS_ADMIN', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "CorrespondenceType" AS ENUM ('INCOMING_LETTER', 'OUTGOING_LETTER', 'INTERNAL_MEMO');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('ROUTINE', 'URGENT', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('SUBMITTED', 'REGISTERED', 'WITH_DG', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'RETURNED');

-- CreateEnum
CREATE TYPE "RecipientKind" AS ENUM ('ACTION', 'COPY');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SUBMITTED', 'REGISTERED', 'ACKNOWLEDGED', 'MINUTED', 'FORWARDED', 'RETURNED', 'RESOLVED', 'CLOSED', 'COMMENTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('STAFF', 'EXTERNAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "workspaceUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "office" TEXT NOT NULL,
    "department" TEXT,
    "division" TEXT,
    "position" TEXT,
    "hierarchyLevel" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correspondence" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "type" "CorrespondenceType" NOT NULL,
    "classification" "Classification" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "subject" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "senderName" TEXT NOT NULL,
    "senderReference" TEXT,
    "dateOnDocument" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "currentOwnerId" TEXT,
    "createdById" TEXT,
    "externalOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "kind" "RecipientKind" NOT NULL,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "instruction" TEXT,
    "dueAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrespondenceEvent" (
    "id" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "type" "EventType" NOT NULL,
    "fromStatus" "CorrespondenceStatus",
    "toStatus" "CorrespondenceStatus",
    "minute" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrespondenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchTokenRedemption" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "workspaceUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchTokenRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_workspaceUserId_key" ON "User"("workspaceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "ExternalOrganization_email_idx" ON "ExternalOrganization"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Correspondence_referenceNumber_key" ON "Correspondence"("referenceNumber");

-- CreateIndex
CREATE INDEX "Correspondence_status_updatedAt_idx" ON "Correspondence"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Correspondence_currentOwnerId_status_idx" ON "Correspondence"("currentOwnerId", "status");

-- CreateIndex
CREATE INDEX "Correspondence_classification_idx" ON "Correspondence"("classification");

-- CreateIndex
CREATE INDEX "Attachment_correspondenceId_idx" ON "Attachment"("correspondenceId");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_status_idx" ON "WorkItem"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_correspondenceId_status_idx" ON "WorkItem"("correspondenceId", "status");

-- CreateIndex
CREATE INDEX "CorrespondenceEvent_correspondenceId_createdAt_idx" ON "CorrespondenceEvent"("correspondenceId", "createdAt");

-- CreateIndex
CREATE INDEX "CorrespondenceEvent_actorId_createdAt_idx" ON "CorrespondenceEvent"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchTokenRedemption_tokenId_key" ON "LaunchTokenRedemption"("tokenId");

-- CreateIndex
CREATE INDEX "LaunchTokenRedemption_workspaceUserId_idx" ON "LaunchTokenRedemption"("workspaceUserId");

-- CreateIndex
CREATE INDEX "LaunchTokenRedemption_expiresAt_idx" ON "LaunchTokenRedemption"("expiresAt");

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_externalOrganizationId_fkey" FOREIGN KEY ("externalOrganizationId") REFERENCES "ExternalOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenceEvent" ADD CONSTRAINT "CorrespondenceEvent_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrespondenceEvent" ADD CONSTRAINT "CorrespondenceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchTokenRedemption" ADD CONSTRAINT "LaunchTokenRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
