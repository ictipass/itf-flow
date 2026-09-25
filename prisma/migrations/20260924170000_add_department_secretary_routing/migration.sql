ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'CLASSIFICATION_CHANGED';

CREATE TABLE "DepartmentSecretaryAssignment" (
  "id" TEXT NOT NULL,
  "departmentKey" TEXT NOT NULL,
  "departmentName" TEXT NOT NULL,
  "secretaryId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartmentSecretaryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepartmentSecretaryAssignment_departmentKey_key"
ON "DepartmentSecretaryAssignment"("departmentKey");

CREATE INDEX "DepartmentSecretaryAssignment_secretaryId_isActive_idx"
ON "DepartmentSecretaryAssignment"("secretaryId", "isActive");

CREATE INDEX "DepartmentSecretaryAssignment_isActive_departmentName_idx"
ON "DepartmentSecretaryAssignment"("isActive", "departmentName");

ALTER TABLE "DepartmentSecretaryAssignment"
ADD CONSTRAINT "DepartmentSecretaryAssignment_secretaryId_fkey"
FOREIGN KEY ("secretaryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DepartmentSecretaryAssignment"
ADD CONSTRAINT "DepartmentSecretaryAssignment_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
