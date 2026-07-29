ALTER TABLE "User"
ADD COLUMN "unit" TEXT,
ADD COLUMN "workspaceOfficeId" TEXT,
ADD COLUMN "workspaceDepartmentId" TEXT,
ADD COLUMN "workspaceDivisionId" TEXT,
ADD COLUMN "workspaceUnitId" TEXT,
ADD COLUMN "workspacePositionId" TEXT,
ADD COLUMN "supervisorId" TEXT;

CREATE INDEX "User_supervisorId_isActive_idx" ON "User"("supervisorId", "isActive");
CREATE INDEX "User_workspaceDepartmentId_idx" ON "User"("workspaceDepartmentId");
CREATE INDEX "User_workspaceDivisionId_idx" ON "User"("workspaceDivisionId");
CREATE INDEX "User_workspaceUnitId_idx" ON "User"("workspaceUnitId");

ALTER TABLE "User"
ADD CONSTRAINT "User_supervisorId_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
