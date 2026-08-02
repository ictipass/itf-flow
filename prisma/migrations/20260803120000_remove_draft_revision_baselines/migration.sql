DELETE FROM "CorrespondenceRevision" revision
USING "Correspondence" correspondence
WHERE revision."correspondenceId" = correspondence."id"
  AND correspondence."status" = 'DRAFT';
