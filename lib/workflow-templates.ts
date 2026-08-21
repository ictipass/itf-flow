import { z } from "zod";
import { CorrespondenceType, Priority, WorkPurpose, WorkflowTemplateVersionStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

export const workflowRulesSchema = z.object({
  routingMode: z.literal("HIERARCHICAL"),
  allowPeerReferral: z.boolean(),
  allowedPurposes: z.array(z.enum(WorkPurpose)).min(1).refine((values) => values.includes(WorkPurpose.ACTION), "Action routing must remain available."),
  requireApprovalForOutgoing: z.boolean(),
}).strict();
export type WorkflowRules = z.infer<typeof workflowRulesSchema>;
type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export function addBusinessDays(start: Date, days: number) { const result = new Date(start); let remaining = days; while (remaining > 0) { result.setDate(result.getDate() + 1); const weekday = result.getDay(); if (weekday !== 0 && weekday !== 6) remaining--; } return result; }
function slaDays(category: { routineSlaDays: number; urgentSlaDays: number; immediateSlaDays: number }, priority: Priority) { return priority === Priority.IMMEDIATE ? category.immediateSlaDays : priority === Priority.URGENT ? category.urgentSlaDays : category.routineSlaDays; }

export async function resolveWorkflowPolicy(tx: TransactionClient, input: { type: CorrespondenceType; priority: Priority; requestedDueAt?: Date | null; categoryCode?: string | null; now?: Date }) {
  const defaultCode = input.type === CorrespondenceType.INCOMING_LETTER ? "GENERAL_INCOMING" : input.type === CorrespondenceType.OUTGOING_LETTER ? "GENERAL_OUTGOING" : "INTERNAL_MEMO";
  const category = await tx.workflowCategory.findFirst({ where: { isActive: true, correspondenceType: input.type, code: input.categoryCode ?? defaultCode }, include: { template: { include: { versions: { where: { status: WorkflowTemplateVersionStatus.ACTIVE }, orderBy: { version: "desc" }, take: 1 } } } } });
  if (!category || !category.template.versions[0]) throw new Error("No active workflow policy exists for this correspondence type.");
  const version = category.template.versions[0]; const rules = workflowRulesSchema.parse(version.rules); const days = slaDays(category, input.priority);
  return { category, version, rules, slaDays: days, dueAt: input.requestedDueAt ?? addBusinessDays(input.now ?? new Date(), days), requiresApproval: input.type === CorrespondenceType.OUTGOING_LETTER && rules.requireApprovalForOutgoing };
}

export async function ensurePurposeAllowed(correspondenceId: string, purpose: WorkPurpose) { const record = await db.correspondence.findUnique({ where: { id: correspondenceId }, include: { workflowTemplateVersion: true } }); if (!record?.workflowTemplateVersion) return null; const rules = workflowRulesSchema.parse(record.workflowTemplateVersion.rules); if (!rules.allowedPurposes.includes(purpose)) throw new Error(`${purpose} is disabled by the correspondence workflow policy.`); return rules; }

export async function simulateWorkflow(input: { type: CorrespondenceType; priority: Priority; categoryCode?: string | null; purpose: WorkPurpose; now?: Date }) { return db.$transaction(async (tx) => { const policy = await resolveWorkflowPolicy(tx, input); const purposeAllowed = policy.rules.allowedPurposes.includes(input.purpose); return { categoryCode: policy.category.code, categoryName: policy.category.name, template: policy.version.templateId, version: policy.version.version, dueAt: policy.dueAt, slaDays: policy.slaDays, purposeAllowed, requiresApproval: policy.requiresApproval || input.purpose === WorkPurpose.APPROVAL, peerReferralAllowed: policy.rules.allowPeerReferral, safe: purposeAllowed }; }); }
