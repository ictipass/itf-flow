ALTER TABLE "User" ADD COLUMN "staffNumber" TEXT;

CREATE UNIQUE INDEX "User_staffNumber_key" ON "User"("staffNumber");
