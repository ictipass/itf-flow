ALTER TYPE "DocumentAnnotationPlacement" ADD VALUE 'CUSTOM';

ALTER TABLE "DocumentAnnotation"
  ADD COLUMN "placementX" DOUBLE PRECISION,
  ADD COLUMN "placementY" DOUBLE PRECISION;
