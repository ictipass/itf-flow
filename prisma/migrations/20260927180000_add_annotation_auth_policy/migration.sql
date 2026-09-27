-- Safe default: existing and new environments continue to require strong authentication.
ALTER TABLE "ApplicationConfiguration"
  ADD COLUMN "annotationMfaRequiredForDg" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "annotationMfaRequiredForDirectors" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "annotationMfaRequiredForDivisionHeads" BOOLEAN NOT NULL DEFAULT true;
