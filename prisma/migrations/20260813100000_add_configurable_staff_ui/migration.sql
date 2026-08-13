CREATE TYPE "StaffUiMode" AS ENUM ('CLASSIC', 'MODERN');

CREATE TABLE "ApplicationConfiguration" (
  "id" TEXT NOT NULL,
  "staffUiMode" "StaffUiMode" NOT NULL DEFAULT 'CLASSIC',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConfigurationChange" (
  "id" TEXT NOT NULL,
  "setting" TEXT NOT NULL,
  "previousValue" TEXT NOT NULL,
  "newValue" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfigurationChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConfigurationChange_setting_createdAt_idx" ON "ConfigurationChange"("setting", "createdAt");
CREATE INDEX "ConfigurationChange_changedById_createdAt_idx" ON "ConfigurationChange"("changedById", "createdAt");

ALTER TABLE "ApplicationConfiguration" ADD CONSTRAINT "ApplicationConfiguration_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConfigurationChange" ADD CONSTRAINT "ConfigurationChange_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ApplicationConfiguration" ("id", "staffUiMode", "version", "updatedAt")
VALUES ('default', 'CLASSIC', 1, CURRENT_TIMESTAMP);
