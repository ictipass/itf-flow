"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

async function admin() { const user = await requireUser(); if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can manage need-to-know groups."); return user; }

export async function createAccessGroupAction(formData: FormData) {
  const actor = await admin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const memberIds = [...new Set(formData.getAll("memberIds").map(String).filter(Boolean))];
  if (name.length < 3 || description.length < 10 || !memberIds.length) throw new Error("Provide a group name, clear purpose and at least one member.");
  const members = await db.user.count({ where: { id: { in: memberIds }, isActive: true } });
  if (members !== memberIds.length) throw new Error("Every group member must be an active staff user.");
  await db.$transaction(async (tx) => { const group = await tx.accessGroup.create({ data: { name, description, createdById: actor.id, members: { createMany: { data: memberIds.map((userId) => ({ userId })) } } } }); await tx.configurationChange.create({ data: { setting: "ACCESS_GROUP_CREATED", previousValue: "NONE", newValue: group.id, reason: description, changedById: actor.id } }); });
  revalidatePath("/admin/access-groups");
}

export async function addAccessGroupMemberAction(formData: FormData) {
  const actor = await admin(); const groupId = String(formData.get("groupId") ?? ""); const userId = String(formData.get("userId") ?? "");
  const user = await db.user.findFirst({ where: { id: userId, isActive: true } });
  if (!user) throw new Error("Select an active user.");
  await db.$transaction([db.accessGroupMember.upsert({ where: { groupId_userId: { groupId, userId } }, create: { groupId, userId }, update: {} }), db.configurationChange.create({ data: { setting: "ACCESS_GROUP_MEMBER_ADDED", previousValue: "ABSENT", newValue: `${groupId}:${userId}`, reason: "Administrator added an active need-to-know member.", changedById: actor.id } })]);
  revalidatePath("/admin/access-groups");
}

export async function assignRecordAccessGroupAction(formData: FormData) {
  const actor = await admin(); const groupId = String(formData.get("groupId") ?? ""); const reference = String(formData.get("reference") ?? "").trim();
  const [group, record] = await Promise.all([db.accessGroup.findFirst({ where: { id: groupId, isActive: true } }), db.correspondence.findUnique({ where: { referenceNumber: reference } })]);
  if (!group || !record || record.status === "DRAFT") throw new Error("Select an active group and a valid submitted correspondence reference.");
  await db.$transaction([db.correspondenceAccessGroup.upsert({ where: { correspondenceId_groupId: { correspondenceId: record.id, groupId } }, create: { correspondenceId: record.id, groupId }, update: {} }), db.configurationChange.create({ data: { setting: "RECORD_ACCESS_GROUP_ASSIGNED", previousValue: "UNRESTRICTED_OR_OTHER_GROUPS", newValue: `${record.id}:${groupId}`, reason: `Need-to-know restriction assigned to ${reference}.`, changedById: actor.id } })]);
  revalidatePath("/admin/access-groups"); revalidatePath(`/correspondence/${record.id}`);
}

export async function removeAccessGroupMemberAction(formData: FormData) {
  const actor = await admin(); const groupId = String(formData.get("groupId") ?? ""); const userId = String(formData.get("userId") ?? ""); const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) throw new Error("Give a removal reason of at least 10 characters.");
  await db.$transaction([db.accessGroupMember.delete({ where: { groupId_userId: { groupId, userId } } }), db.configurationChange.create({ data: { setting: "ACCESS_GROUP_MEMBER_REMOVED", previousValue: `${groupId}:${userId}`, newValue: "REMOVED", reason, changedById: actor.id } })]);
  revalidatePath("/admin/access-groups");
}

export async function removeRecordAccessGroupAction(formData: FormData) {
  const actor = await admin(); const correspondenceId = String(formData.get("correspondenceId") ?? ""); const groupId = String(formData.get("groupId") ?? ""); const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) throw new Error("Give an unrestriction reason of at least 10 characters.");
  await db.$transaction([db.correspondenceAccessGroup.delete({ where: { correspondenceId_groupId: { correspondenceId, groupId } } }), db.configurationChange.create({ data: { setting: "RECORD_ACCESS_GROUP_REMOVED", previousValue: `${correspondenceId}:${groupId}`, newValue: "REMOVED", reason, changedById: actor.id } })]);
  revalidatePath("/admin/access-groups"); revalidatePath(`/correspondence/${correspondenceId}`);
}
