"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EventType, RecordCategory, RetentionDisposition, RetentionTrigger, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { activeOrganizationUnitOptions, canManageRecordsCatalogue } from "@/lib/records-catalogue";
import { normalizedLegacyKey } from "@/lib/records-catalogue-shared";
import { requireUser } from "@/lib/session";
import { resolveCatalogueFilingInput, resolveRecordFile } from "@/lib/records-governance";
import { registryAuthorizationFor } from "@/lib/registry-access";

const codePattern = /^[A-Z0-9][A-Z0-9._/-]{2,79}$/;

async function catalogueManager() {
  const user = await requireUser();
  if (!canManageRecordsCatalogue(user.role)) redirect("/dashboard");
  return user;
}

function catalogueRedirect(value: string): never {
  redirect(`/records/catalogue?${value}=1`);
}

export async function createRetentionPolicyAction(formData: FormData) {
  const actor = await catalogueManager();
  const parsed = z.object({
    code: z.string().trim().toUpperCase().regex(codePattern),
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(1000),
    trigger: z.enum(RetentionTrigger),
    durationYears: z.string().trim().optional(),
    disposition: z.enum(RetentionDisposition),
    legalAuthority: z.string().trim().min(5).max(500),
    reason: z.string().trim().min(10).max(500),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) catalogueRedirect("error");
  const durationYears = parsed.data.trigger === RetentionTrigger.PERMANENT || parsed.data.disposition === RetentionDisposition.PERMANENT
    ? null
    : Number(parsed.data.durationYears);
  if (durationYears !== null && (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 100)) catalogueRedirect("error");
  const existing = await db.retentionPolicy.findFirst({ where: { code: parsed.data.code, isActive: true }, select: { id: true } });
  if (existing) catalogueRedirect("duplicate");
  const latest = await db.retentionPolicy.aggregate({ where: { code: parsed.data.code }, _max: { version: true } });
  await db.$transaction(async (tx) => {
    const policy = await tx.retentionPolicy.create({ data: { ...parsed.data, durationYears, version: (latest._max.version ?? 0) + 1, createdById: actor.id } });
    await tx.configurationChange.create({ data: { setting: "RETENTION_POLICY_CREATED", previousValue: "NONE", newValue: `${policy.code}:v${policy.version}`, reason: parsed.data.reason, changedById: actor.id } });
  });
  revalidatePath("/records/catalogue");
  catalogueRedirect("policyCreated");
}

export async function retireRetentionPolicyAction(formData: FormData) {
  const actor = await catalogueManager();
  const parsed = z.object({ policyId: z.string().min(1), reason: z.string().trim().min(10).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) catalogueRedirect("error");
  const activeSeries = await db.recordSeries.count({ where: { retentionPolicyId: parsed.data.policyId, isActive: true } });
  if (activeSeries) catalogueRedirect("policyInUse");
  const policy = await db.retentionPolicy.findFirst({ where: { id: parsed.data.policyId, isActive: true } });
  if (!policy) catalogueRedirect("stale");
  await db.$transaction([
    db.retentionPolicy.update({ where: { id: policy.id }, data: { isActive: false, retiredAt: new Date() } }),
    db.configurationChange.create({ data: { setting: "RETENTION_POLICY_RETIRED", previousValue: `${policy.code}:v${policy.version}`, newValue: "RETIRED", reason: parsed.data.reason, changedById: actor.id } }),
  ]);
  revalidatePath("/records/catalogue");
  catalogueRedirect("policyRetired");
}

export async function createRecordSeriesAction(formData: FormData) {
  const actor = await catalogueManager();
  const parsed = z.object({
    code: z.string().trim().toUpperCase().regex(codePattern),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(1000),
    category: z.enum(RecordCategory),
    retentionPolicyId: z.string().min(1),
    defaultOwnerOrgUnitKey: z.string().min(1).max(200),
    legacyUnit: z.string().trim().max(160).optional(),
    legacyBoxCategory: z.string().trim().max(160).optional(),
    reason: z.string().trim().min(10).max(500),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) catalogueRedirect("error");
  const [policy, organizations, existing, latest] = await Promise.all([
    db.retentionPolicy.findFirst({ where: { id: parsed.data.retentionPolicyId, isActive: true } }),
    activeOrganizationUnitOptions(),
    db.recordSeries.findFirst({ where: { code: parsed.data.code, isActive: true }, select: { id: true } }),
    db.recordSeries.aggregate({ where: { code: parsed.data.code }, _max: { version: true } }),
  ]);
  const owner = organizations.find((item) => item.key === parsed.data.defaultOwnerOrgUnitKey);
  if (!policy || !owner) catalogueRedirect("error");
  if (existing) catalogueRedirect("duplicate");
  await db.$transaction(async (tx) => {
    const series = await tx.recordSeries.create({ data: {
      code: parsed.data.code, title: parsed.data.title, description: parsed.data.description,
      category: parsed.data.category, retentionPolicyId: policy.id,
      defaultOwnerOrgUnitKey: owner.key, defaultOwnerOrgUnitName: owner.name,
      legacyUnit: parsed.data.legacyUnit || null, legacyBoxCategory: parsed.data.legacyBoxCategory || null,
      version: (latest._max.version ?? 0) + 1, reason: parsed.data.reason, createdById: actor.id,
    } });
    await tx.configurationChange.create({ data: { setting: "RECORD_SERIES_CREATED", previousValue: "NONE", newValue: `${series.code}:v${series.version}`, reason: parsed.data.reason, changedById: actor.id } });
  });
  revalidatePath("/records/catalogue");
  revalidatePath("/correspondence/new");
  catalogueRedirect("seriesCreated");
}

export async function retireRecordSeriesAction(formData: FormData) {
  const actor = await catalogueManager();
  const parsed = z.object({ seriesId: z.string().min(1), reason: z.string().trim().min(10).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) catalogueRedirect("error");
  const series = await db.recordSeries.findFirst({ where: { id: parsed.data.seriesId, isActive: true } });
  if (!series) catalogueRedirect("stale");
  await db.$transaction([
    db.recordSeries.update({ where: { id: series.id }, data: { isActive: false, retiredAt: new Date() } }),
    db.configurationChange.create({ data: { setting: "RECORD_SERIES_RETIRED", previousValue: `${series.code}:v${series.version}`, newValue: "RETIRED", reason: parsed.data.reason, changedById: actor.id } }),
  ]);
  revalidatePath("/records/catalogue");
  revalidatePath("/correspondence/new");
  catalogueRedirect("seriesRetired");
}

export async function registerLegacyPersonnelFileAction(formData: FormData) {
  const actor = await catalogueManager();
  const parsed = z.object({
    subjectUserId: z.string().min(1),
    legacyDocumentId: z.string().trim().max(160).optional(),
    legacyFolderId: z.string().trim().max(160).optional(),
    legacyUnit: z.string().trim().min(2).max(160),
    boxCategory: z.string().trim().min(2).max(160),
    boxNumber: z.string().trim().min(1).max(160),
    fileVolume: z.string().trim().max(80).optional(),
    legacyRefId: z.string().trim().min(1).max(160),
    legacyRefName: z.string().trim().max(200).optional(),
    fileOpenDate: z.string().optional(),
    fileCloseDate: z.string().optional(),
    storagePath: z.string().trim().max(1000).optional(),
    sha256: z.string().trim().toLowerCase().regex(/^$|^[a-f0-9]{64}$/).optional(),
    reason: z.string().trim().min(10).max(500),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) catalogueRedirect("legacyError");
  const subject = await db.user.findFirst({ where: { id: parsed.data.subjectUserId, isActive: true }, select: { id: true, staffNumber: true } });
  if (!subject) catalogueRedirect("legacyError");
  const legacyKey = normalizedLegacyKey([parsed.data.legacyUnit, parsed.data.boxCategory, parsed.data.boxNumber, parsed.data.fileVolume]);
  const parseDate = (value?: string) => value ? new Date(`${value}T00:00:00.000+01:00`) : null;
  const openDate = parseDate(parsed.data.fileOpenDate);
  const closeDate = parseDate(parsed.data.fileCloseDate);
  if ((openDate && !Number.isFinite(openDate.getTime())) || (closeDate && !Number.isFinite(closeDate.getTime())) || (openDate && closeDate && closeDate < openDate)) catalogueRedirect("legacyError");
  await db.$transaction(async (tx) => {
    const mapping = await tx.legacyPersonnelFile.create({ data: {
      legacyKey, subjectUserId: subject.id, legacyDocumentId: parsed.data.legacyDocumentId || null,
      legacyFolderId: parsed.data.legacyFolderId || null, legacyUnit: parsed.data.legacyUnit,
      boxCategory: parsed.data.boxCategory, boxNumber: parsed.data.boxNumber, fileVolume: parsed.data.fileVolume || null,
      legacyRefId: parsed.data.legacyRefId, legacyRefName: parsed.data.legacyRefName || null,
      fileOpenDate: openDate, fileCloseDate: closeDate, storagePath: parsed.data.storagePath || null,
      sha256: parsed.data.sha256 || null, reason: parsed.data.reason, mappedById: actor.id,
    } });
    await tx.configurationChange.create({ data: { setting: "LEGACY_PERSONNEL_FILE_MAPPED", previousValue: "NONE", newValue: `${mapping.legacyKey}:${subject.staffNumber ?? subject.id}`, reason: parsed.data.reason, changedById: actor.id } });
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) catalogueRedirect("duplicate");
    throw error;
  });
  revalidatePath("/records/catalogue");
  catalogueRedirect("legacyMapped");
}

export async function retireLegacyPersonnelFileAction(formData: FormData) {
  const actor = await catalogueManager();
  const parsed = z.object({ mappingId: z.string().min(1), reason: z.string().trim().min(10).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) catalogueRedirect("legacyError");
  const mapping = await db.legacyPersonnelFile.findFirst({ where: { id: parsed.data.mappingId, isActive: true } });
  if (!mapping) catalogueRedirect("stale");
  await db.$transaction([
    db.legacyPersonnelFile.update({ where: { id: mapping.id }, data: { isActive: false } }),
    db.configurationChange.create({ data: { setting: "LEGACY_PERSONNEL_FILE_RETIRED", previousValue: mapping.legacyKey, newValue: "RETIRED", reason: parsed.data.reason, changedById: actor.id } }),
  ]);
  revalidatePath("/records/catalogue");
  catalogueRedirect("legacyRetired");
}

export async function refileCorrespondenceAction(formData: FormData) {
  const actor = await catalogueManager();
  const parsed = z.object({
    correspondenceId: z.string().min(1),
    reason: z.string().trim().min(10).max(500),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/records/catalogue?error=1");
  const record = await db.correspondence.findUnique({
    where: { id: parsed.data.correspondenceId },
    select: { id: true, classification: true, recordFileId: true },
  });
  if (!record) redirect("/records/catalogue?error=1");
  if (actor.role !== UserRole.SYSTEM_ADMIN) {
    const authorization = await registryAuthorizationFor(actor, record.classification);
    if (authorization.needsStepUp) redirect(`/step-up?returnTo=${encodeURIComponent(`/correspondence/${record.id}`)}`);
    if (!authorization.allowed) redirect("/dashboard");
  }
  try {
    const filing = await resolveCatalogueFilingInput(formData, actor, true);
    await db.$transaction(async (tx) => {
      const officialFile = await resolveRecordFile(tx, filing!);
      if (officialFile.id === record.recordFileId) throw new Error("SAME_FILE");
      await tx.correspondence.update({ where: { id: record.id }, data: { recordFileId: officialFile.id } });
      await tx.correspondenceEvent.create({ data: {
        correspondenceId: record.id,
        actorId: actor.id,
        actorType: "STAFF",
        type: EventType.REFILED,
        minute: parsed.data.reason,
        metadata: { previousRecordFileId: record.recordFileId, newRecordFileId: officialFile.id, recordSeriesId: filing!.recordSeriesId, recordSeriesVersion: filing!.recordSeriesVersion },
      } });
      await tx.configurationChange.create({ data: {
        setting: "CORRESPONDENCE_REFILED",
        previousValue: `${record.id}:${record.recordFileId ?? "UNFILED"}`,
        newValue: `${record.id}:${officialFile.id}`,
        reason: parsed.data.reason,
        changedById: actor.id,
      } });
    });
  } catch (error) {
    if (!(error instanceof Error && error.message === "SAME_FILE")) console.error("Audited correspondence re-filing failed.", error);
    redirect(`/correspondence/${record.id}?refileError=1`);
  }
  revalidatePath(`/correspondence/${record.id}`);
  revalidatePath("/records");
  redirect(`/correspondence/${record.id}?refiled=1`);
}
