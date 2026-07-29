import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

const userSchema = z.object({
  workspaceUserId: z.string().min(1),
  staffNumber: z.string().nullable(),
  email: z.email(),
  name: z.string().min(1),
  role: z.enum(UserRole),
  isActive: z.boolean(),
  office: z.object({ id: z.string(), name: z.string() }).nullable(),
  department: z.object({ id: z.string(), name: z.string() }).nullable(),
  division: z.object({ id: z.string(), name: z.string() }).nullable(),
  unit: z.object({ id: z.string(), name: z.string() }).nullable(),
  position: z.object({ id: z.string(), name: z.string() }).nullable(),
  supervisorWorkspaceUserId: z.string().nullable(),
});

const payloadSchema = z.object({
  source: z.literal("itf-workspace"),
  users: z.array(userSchema).min(1).max(500),
});

function authorized(request: Request) {
  const configured = process.env.WORKSPACE_DIRECTORY_SYNC_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid directory payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const run = await db.provisioningRun.create({
    data: {
      source: parsed.data.source,
      status: "RUNNING",
      receivedCount: parsed.data.users.length,
    },
  });

  try {
    const existing = await db.user.findMany({
      where: {
        OR: [
          { workspaceUserId: { in: parsed.data.users.map((user) => user.workspaceUserId) } },
          { email: { in: parsed.data.users.map((user) => user.email.toLowerCase()) } },
        ],
      },
      select: { id: true, workspaceUserId: true, email: true },
    });
    const existingWorkspaceIds = new Set(existing.map((user) => user.workspaceUserId).filter(Boolean));
    let createdCount = 0;
    let updatedCount = 0;
    let inactiveCount = 0;

    await db.$transaction(async (tx) => {
      for (const item of parsed.data.users) {
        const wasExisting =
          existingWorkspaceIds.has(item.workspaceUserId) ||
          existing.some((user) => user.email === item.email.toLowerCase());
        await tx.user.upsert({
          where: { email: item.email.toLowerCase() },
          update: {
            workspaceUserId: item.workspaceUserId,
            staffNumber: item.staffNumber,
            name: item.name,
            role: item.role,
            isActive: item.isActive,
            office: item.office?.name ?? "ITF",
            department: item.department?.name,
            division: item.division?.name,
            unit: item.unit?.name,
            position: item.position?.name,
            workspaceOfficeId: item.office?.id,
            workspaceDepartmentId: item.department?.id,
            workspaceDivisionId: item.division?.id,
            workspaceUnitId: item.unit?.id,
            workspacePositionId: item.position?.id,
          },
          create: {
            workspaceUserId: item.workspaceUserId,
            staffNumber: item.staffNumber,
            email: item.email.toLowerCase(),
            name: item.name,
            role: item.role,
            isActive: item.isActive,
            office: item.office?.name ?? "ITF",
            department: item.department?.name,
            division: item.division?.name,
            unit: item.unit?.name,
            position: item.position?.name,
            workspaceOfficeId: item.office?.id,
            workspaceDepartmentId: item.department?.id,
            workspaceDivisionId: item.division?.id,
            workspaceUnitId: item.unit?.id,
            workspacePositionId: item.position?.id,
            hierarchyLevel: 1,
          },
        });
        if (wasExisting) updatedCount += 1;
        else createdCount += 1;
        if (!item.isActive) inactiveCount += 1;
      }

      for (const item of parsed.data.users) {
        const supervisor = item.supervisorWorkspaceUserId
          ? await tx.user.findUnique({
              where: { workspaceUserId: item.supervisorWorkspaceUserId },
              select: { id: true },
            })
          : null;
        await tx.user.update({
          where: { email: item.email.toLowerCase() },
          data: { supervisorId: supervisor?.id ?? null },
        });
      }
    });

    await db.provisioningRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        createdCount,
        updatedCount,
        inactiveCount,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ runId: run.id, createdCount, updatedCount, inactiveCount });
  } catch (error) {
    await db.provisioningRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ error: "Directory synchronization failed.", runId: run.id }, { status: 500 });
  }
}
