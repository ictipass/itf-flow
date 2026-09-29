import { createHash } from "crypto";
import { CorrespondenceType, RecordCategory, RegistryScope, UltimateRecipientType, type Prisma, type User } from "@/lib/generated/prisma/client";

type FilingActor = Pick<User, "id" | "name" | "department" | "office" | "workspaceDepartmentId" | "staffNumber">;

function bounded(value: FormDataEntryValue | null, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function keyPart(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "general";
}

export type FilingInput = {
  category: RecordCategory;
  filePlanCode: string;
  retentionClass: string;
  subjectUserId: string | null;
  ownerOrgUnitKey: string | null;
  ownerOrgUnitName: string | null;
};

export function parseFilingInput(formData: FormData, actor: FilingActor, strict = true): FilingInput | null {
  const categoryValue = bounded(formData.get("recordCategory"), 40);
  const category = Object.values(RecordCategory).includes(categoryValue as RecordCategory) ? categoryValue as RecordCategory : null;
  const filePlanCode = bounded(formData.get("filePlanCode"), 80).toUpperCase();
  const retentionClass = bounded(formData.get("retentionClass"), 80).toUpperCase();
  if (!category || !filePlanCode || !retentionClass) {
    if (strict) throw new Error("Select an official filing category, file-plan code and retention class.");
    return null;
  }
  const subjectUserId = bounded(formData.get("recordSubjectUserId"), 100) || null;
  const ownerOrgUnitName = bounded(formData.get("ownerOrgUnitName"), 160) || actor.department || actor.office || null;
  const ownerOrgUnitKey = actor.workspaceDepartmentId
    ? `workspace:${actor.workspaceDepartmentId}`
    : ownerOrgUnitName ? `name:${keyPart(ownerOrgUnitName)}` : null;
  if (category === RecordCategory.PERSONNEL && !subjectUserId) {
    if (strict) throw new Error("A personnel record must identify the staff member whose official file owns it.");
    return null;
  }
  if (category === RecordCategory.OFFICE && !ownerOrgUnitName) {
    if (strict) throw new Error("An office record must identify its owning department or unit.");
    return null;
  }
  return { category, filePlanCode, retentionClass, subjectUserId, ownerOrgUnitKey, ownerOrgUnitName };
}

export async function resolveRecordFile(tx: Prisma.TransactionClient, input: FilingInput) {
  let subject: Pick<User, "id" | "name" | "staffNumber"> | null = null;
  if (input.subjectUserId) {
    subject = await tx.user.findFirst({ where: { id: input.subjectUserId, isActive: true }, select: { id: true, name: true, staffNumber: true } });
    if (!subject) throw new Error("The selected personnel-file subject is not an active staff member.");
  }
  const ownerIdentity = input.category === RecordCategory.PERSONNEL
    ? subject!.id
    : input.category === RecordCategory.OFFICE
      ? input.ownerOrgUnitKey!
      : input.category === RecordCategory.EXTERNAL_CASE
        ? input.ownerOrgUnitName ?? "external"
        : "itf";
  const fileKey = `${input.category.toLowerCase()}:${keyPart(ownerIdentity)}:${keyPart(input.filePlanCode)}`;
  const label = input.category === RecordCategory.PERSONNEL
    ? `${subject!.name} personnel file · ${input.filePlanCode}`
    : `${input.ownerOrgUnitName ?? "ITF corporate"} · ${input.filePlanCode}`;
  return tx.recordFile.upsert({
    where: { fileKey },
    create: { fileKey, category: input.category, label, filePlanCode: input.filePlanCode, retentionClass: input.retentionClass, subjectUserId: subject?.id, ownerOrgUnitKey: input.ownerOrgUnitKey, ownerOrgUnitName: input.ownerOrgUnitName },
    update: { label, retentionClass: input.retentionClass, subjectUserId: subject?.id, ownerOrgUnitKey: input.ownerOrgUnitKey, ownerOrgUnitName: input.ownerOrgUnitName },
  });
}

export async function resolveUltimateRecipient(formData: FormData, type: CorrespondenceType, fallbackUserId?: string | null) {
  if (type === CorrespondenceType.INTERNAL_MEMO) {
    const id = bounded(formData.get("ultimateRecipientUserId"), 100) || fallbackUserId;
    const { db } = await import("@/lib/db");
    const user = id ? await db.user.findFirst({ where: { id, isActive: true }, select: { id: true, name: true, workspaceDepartmentId: true, department: true, office: true } }) : null;
    if (!user) throw new Error("Select the active staff member who is the ultimate recipient of this correspondence.");
    return { ultimateRecipientType: UltimateRecipientType.STAFF, ultimateRecipientUserId: user.id, ultimateRecipientName: user.name, ultimateRecipientOrgUnitKey: user.workspaceDepartmentId ? `workspace:${user.workspaceDepartmentId}` : null, ultimateRecipientOrgUnitName: user.department ?? user.office };
  }
  const name = bounded(formData.get("ultimateRecipientName"), 200);
  if (!name) throw new Error("Identify the ultimate external recipient or destination office.");
  const organizational = type === CorrespondenceType.INCOMING_LETTER;
  return { ultimateRecipientType: organizational ? UltimateRecipientType.ORGANIZATIONAL_UNIT : UltimateRecipientType.EXTERNAL_PARTY, ultimateRecipientUserId: null, ultimateRecipientName: name, ultimateRecipientOrgUnitKey: organizational ? `name:${keyPart(name)}` : null, ultimateRecipientOrgUnitName: organizational ? name : null };
}

export function recordStorageSegment(recordFileId: string | null | undefined) {
  return recordFileId ? `file-${recordFileId}` : "unfiled";
}

export function activeRegistryAppointmentWhere(userId: string, now = new Date()) {
  return { userId, revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] };
}

export function registryCanRead(scope: RegistryScope, classification: string) {
  return scope === RegistryScope.SECRET || classification === "PUBLIC" || classification === "INTERNAL";
}

export function evidencePackageId(correspondenceId: string, generatedAt: Date) {
  return createHash("sha256").update(`${correspondenceId}:${generatedAt.toISOString()}`).digest("hex").slice(0, 20);
}
