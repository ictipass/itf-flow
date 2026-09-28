ALTER TABLE "SignatureProfile" ALTER COLUMN "status" SET DEFAULT 'APPROVED';

UPDATE "SignatureProfile" AS current
SET
  "status" = 'SUPERSEDED',
  "reviewedAt" = COALESCE("reviewedAt", "submittedAt"),
  "reviewReason" = 'Superseded by the staff member''s later authenticated signature submission.'
WHERE "status" = 'APPROVED'
  AND EXISTS (
    SELECT 1 FROM "SignatureProfile" AS pending
    WHERE pending."userId" = current."userId"
      AND pending."status" = 'PENDING_REVIEW'
      AND pending."version" > current."version"
  );

UPDATE "SignatureProfile" AS pending
SET
  "status" = CASE
    WHEN pending."version" = (
      SELECT MAX(latest."version") FROM "SignatureProfile" AS latest WHERE latest."userId" = pending."userId"
    ) THEN 'APPROVED'::"SignatureProfileStatus"
    ELSE 'SUPERSEDED'::"SignatureProfileStatus"
  END,
  "reviewedAt" = COALESCE(pending."reviewedAt", pending."submittedAt"),
  "reviewReason" = CASE
    WHEN pending."version" = (
      SELECT MAX(latest."version") FROM "SignatureProfile" AS latest WHERE latest."userId" = pending."userId"
    ) THEN 'Activated by authenticated staff self-submission.'
    ELSE 'Superseded by the staff member''s later authenticated signature submission.'
  END
WHERE pending."status" = 'PENDING_REVIEW';
