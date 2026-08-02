CREATE TYPE "WorkPurpose" AS ENUM ('ACTION', 'REVIEW', 'CONCURRENCE', 'APPROVAL');
CREATE TYPE "DecisionOutcome" AS ENUM ('RECOMMENDED', 'CONCURRED', 'APPROVED', 'REJECTED', 'RETURNED');

ALTER TYPE "EventType" ADD VALUE 'DECISION_REQUESTED' AFTER 'REFERRED';
ALTER TYPE "EventType" ADD VALUE 'DECISION_RECORDED' AFTER 'DECISION_REQUESTED';

ALTER TABLE "WorkItem" ADD COLUMN "purpose" "WorkPurpose" NOT NULL DEFAULT 'ACTION';
ALTER TABLE "Correspondence" ADD COLUMN "draftWorkPurpose" "WorkPurpose" NOT NULL DEFAULT 'ACTION';

CREATE TABLE "DecisionRequest" (
  "id" TEXT NOT NULL,
  "correspondenceId" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "purpose" "WorkPurpose" NOT NULL,
  "outcome" "DecisionOutcome",
  "decisionNote" TEXT,
  "decidedById" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "DecisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DecisionRequest_workItemId_key" ON "DecisionRequest"("workItemId");
CREATE INDEX "DecisionRequest_correspondenceId_requestedAt_idx" ON "DecisionRequest"("correspondenceId", "requestedAt");
CREATE INDEX "DecisionRequest_requestedById_requestedAt_idx" ON "DecisionRequest"("requestedById", "requestedAt");
CREATE INDEX "DecisionRequest_decidedById_decidedAt_idx" ON "DecisionRequest"("decidedById", "decidedAt");

ALTER TABLE "DecisionRequest" ADD CONSTRAINT "DecisionRequest_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionRequest" ADD CONSTRAINT "DecisionRequest_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionRequest" ADD CONSTRAINT "DecisionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionRequest" ADD CONSTRAINT "DecisionRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
