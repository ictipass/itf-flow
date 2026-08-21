CREATE UNIQUE INDEX "WorkflowTemplateVersion_one_active_per_template_key"
ON "WorkflowTemplateVersion"("templateId")
WHERE "status" = 'ACTIVE';
