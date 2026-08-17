ALTER TYPE "NotificationType" ADD VALUE 'DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE 'DAILY_DIGEST';

CREATE TYPE "ScheduledAutomationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "WorkflowReminderPolicy" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "reminderLeadDays" INTEGER NOT NULL DEFAULT 2,
  "escalationAfterDays" INTEGER NOT NULL DEFAULT 1,
  "executiveDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
  "timeZone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowReminderPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledAutomationRun" (
  "id" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "status" "ScheduledAutomationStatus" NOT NULL DEFAULT 'RUNNING',
  "reminderCount" INTEGER NOT NULL DEFAULT 0,
  "overdueCount" INTEGER NOT NULL DEFAULT 0,
  "escalationCount" INTEGER NOT NULL DEFAULT 0,
  "digestCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ScheduledAutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledAutomationRun_job_startedAt_idx" ON "ScheduledAutomationRun"("job", "startedAt");
CREATE INDEX "ScheduledAutomationRun_status_startedAt_idx" ON "ScheduledAutomationRun"("status", "startedAt");
ALTER TABLE "WorkflowReminderPolicy" ADD CONSTRAINT "WorkflowReminderPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WorkflowReminderPolicy" ("id", "enabled", "reminderLeadDays", "escalationAfterDays", "executiveDigestEnabled", "timeZone", "version", "updatedAt")
VALUES ('default', true, 2, 1, true, 'Africa/Lagos', 1, CURRENT_TIMESTAMP);
