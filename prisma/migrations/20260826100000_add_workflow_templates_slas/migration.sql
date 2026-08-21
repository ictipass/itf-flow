CREATE TYPE "WorkflowTemplateVersionStatus" AS ENUM ('DRAFT','ACTIVE','RETIRED');
CREATE TABLE "WorkflowTemplate" ("id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id"));
CREATE TABLE "WorkflowTemplateVersion" ("id" TEXT NOT NULL, "templateId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" "WorkflowTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT', "rules" JSONB NOT NULL, "changeReason" TEXT NOT NULL, "createdById" TEXT, "activatedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "activatedAt" TIMESTAMP(3), "retiredAt" TIMESTAMP(3), CONSTRAINT "WorkflowTemplateVersion_pkey" PRIMARY KEY ("id"));
CREATE TABLE "WorkflowCategory" ("id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "correspondenceType" "CorrespondenceType" NOT NULL, "templateId" TEXT NOT NULL, "routineSlaDays" INTEGER NOT NULL, "urgentSlaDays" INTEGER NOT NULL, "immediateSlaDays" INTEGER NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1, "updatedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WorkflowCategory_pkey" PRIMARY KEY ("id"));
ALTER TABLE "Correspondence" ADD COLUMN "workflowTemplateVersionId" TEXT, ADD COLUMN "workflowCategoryId" TEXT;
CREATE UNIQUE INDEX "WorkflowTemplate_slug_key" ON "WorkflowTemplate"("slug");
CREATE UNIQUE INDEX "WorkflowTemplateVersion_templateId_version_key" ON "WorkflowTemplateVersion"("templateId","version");
CREATE INDEX "WorkflowTemplateVersion_templateId_status_version_idx" ON "WorkflowTemplateVersion"("templateId","status","version");
CREATE UNIQUE INDEX "WorkflowCategory_code_key" ON "WorkflowCategory"("code");
CREATE INDEX "WorkflowCategory_correspondenceType_isActive_idx" ON "WorkflowCategory"("correspondenceType","isActive");
CREATE INDEX "Correspondence_workflowCategoryId_status_idx" ON "Correspondence"("workflowCategoryId","status");
ALTER TABLE "WorkflowTemplateVersion" ADD CONSTRAINT "WorkflowTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateVersion" ADD CONSTRAINT "WorkflowTemplateVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateVersion" ADD CONSTRAINT "WorkflowTemplateVersion_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowCategory" ADD CONSTRAINT "WorkflowCategory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowCategory" ADD CONSTRAINT "WorkflowCategory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_workflowTemplateVersionId_fkey" FOREIGN KEY ("workflowTemplateVersionId") REFERENCES "WorkflowTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_workflowCategoryId_fkey" FOREIGN KEY ("workflowCategoryId") REFERENCES "WorkflowCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "WorkflowTemplate" ("id","slug","name","description") VALUES ('workflow_standard','standard-correspondence','Standard correspondence','Controlled ITF routing, review, approval and dispatch policy.');
INSERT INTO "WorkflowTemplateVersion" ("id","templateId","version","status","rules","changeReason","activatedAt") VALUES ('workflow_standard_v1','workflow_standard',1,'ACTIVE','{"routingMode":"HIERARCHICAL","allowPeerReferral":true,"allowedPurposes":["ACTION","REVIEW","CONCURRENCE","APPROVAL"],"requireApprovalForOutgoing":true}'::jsonb,'Seeded from the established ITF Flow workflow.',CURRENT_TIMESTAMP);
INSERT INTO "WorkflowCategory" ("id","code","name","description","correspondenceType","templateId","routineSlaDays","urgentSlaDays","immediateSlaDays","updatedAt") VALUES
('category_general_incoming','GENERAL_INCOMING','General incoming','Default incoming correspondence category.','INCOMING_LETTER','workflow_standard',10,5,2,CURRENT_TIMESTAMP),
('category_general_outgoing','GENERAL_OUTGOING','General outgoing','Default outgoing correspondence category.','OUTGOING_LETTER','workflow_standard',10,5,2,CURRENT_TIMESTAMP),
('category_internal_memo','INTERNAL_MEMO','Internal memo','Default internal memorandum category.','INTERNAL_MEMO','workflow_standard',7,3,1,CURRENT_TIMESTAMP);
