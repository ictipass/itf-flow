ALTER TYPE "EventType" ADD VALUE 'REVISED' AFTER 'DECISION_RECORDED';

ALTER TABLE "DecisionRequest"
ADD COLUMN "supersededAt" TIMESTAMP(3),
ADD COLUMN "supersededByVersion" INTEGER;

CREATE TABLE "CorrespondenceRevision" (
  "id" TEXT NOT NULL,
  "correspondenceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT,
  "classification" "Classification" NOT NULL,
  "priority" "Priority" NOT NULL,
  "senderReference" TEXT,
  "dueAt" TIMESTAMP(3),
  "attachments" JSONB NOT NULL,
  "changeNote" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorrespondenceRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CorrespondenceRevision_correspondenceId_version_key" ON "CorrespondenceRevision"("correspondenceId", "version");
CREATE INDEX "CorrespondenceRevision_correspondenceId_createdAt_idx" ON "CorrespondenceRevision"("correspondenceId", "createdAt");
ALTER TABLE "CorrespondenceRevision" ADD CONSTRAINT "CorrespondenceRevision_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorrespondenceRevision" ADD CONSTRAINT "CorrespondenceRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CorrespondenceRevision" (
  "id", "correspondenceId", "version", "subject", "summary", "body", "classification",
  "priority", "senderReference", "dueAt", "attachments", "changeNote", "createdById", "createdAt"
)
SELECT
  'rev_' || md5(c."id"), c."id", 1, c."subject", c."summary", c."body", c."classification",
  c."priority", c."senderReference", c."dueAt", '[]'::jsonb,
  'Baseline captured during revision-history rollout.', c."createdById", c."createdAt"
FROM "Correspondence" c;
