ALTER TABLE "Attachment" ADD COLUMN "isMemoPacket" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Attachment_correspondenceId_isMemoPacket_isIncluded_idx"
ON "Attachment"("correspondenceId", "isMemoPacket", "isIncluded");
