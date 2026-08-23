import { createHash } from "node:crypto";
import { z } from "zod";
import { UserRole } from "@/lib/generated/prisma/client";

export const WORKSPACE_DIRECTORY_VERSION = "itf-workspace-directory-v1" as const;

const organizationRecord = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
});

export const workspaceDirectoryUserSchema = z.object({
  workspaceUserId: z.string().min(1).max(200),
  staffNumber: z.string().min(1).max(100).nullable(),
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  name: z.string().min(1).max(300),
  role: z.enum(UserRole),
  isActive: z.boolean(),
  office: organizationRecord.nullable(),
  department: organizationRecord.nullable(),
  division: organizationRecord.nullable(),
  unit: organizationRecord.nullable(),
  position: organizationRecord.nullable(),
  supervisorWorkspaceUserId: z.string().min(1).max(200).nullable(),
});

export const workspaceDirectoryBatchSchema = z.object({
  version: z.literal(WORKSPACE_DIRECTORY_VERSION),
  requestId: z.string().uuid(),
  source: z.literal("itf-workspace"),
  targetAppSlug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  batch: z.object({
    index: z.number().int().min(1),
    count: z.number().int().min(1),
  }).refine((batch) => batch.index <= batch.count, {
    message: "Batch index must not exceed batch count.",
  }),
  users: z.array(workspaceDirectoryUserSchema).min(1).max(500),
}).superRefine((value, context) => {
  const workspaceIds = new Set<string>();
  const emails = new Set<string>();
  value.users.forEach((user, index) => {
    if (workspaceIds.has(user.workspaceUserId)) {
      context.addIssue({
        code: "custom",
        message: "Workspace user IDs must be unique within a batch.",
        path: ["users", index, "workspaceUserId"],
      });
    }
    if (emails.has(user.email)) {
      context.addIssue({
        code: "custom",
        message: "Emails must be unique within a batch.",
        path: ["users", index, "email"],
      });
    }
    workspaceIds.add(user.workspaceUserId);
    emails.add(user.email);
  });
});

export type WorkspaceDirectoryBatch = z.infer<typeof workspaceDirectoryBatchSchema>;

export function directoryBatchDigest(batch: WorkspaceDirectoryBatch) {
  return createHash("sha256").update(JSON.stringify(batch)).digest("hex");
}

type ExistingIdentity = {
  id: string;
  workspaceUserId: string | null;
  email: string;
};

export function resolveProvisioningIdentity(
  workspaceUserId: string,
  byWorkspaceId: ExistingIdentity | null,
  byEmail: ExistingIdentity | null
) {
  if (byWorkspaceId && byEmail && byWorkspaceId.id !== byEmail.id) {
    throw new Error("Workspace identity conflicts with an email assigned to another Flow user.");
  }
  if (byEmail?.workspaceUserId && byEmail.workspaceUserId !== workspaceUserId) {
    throw new Error("Email is already linked to a different immutable Workspace identity.");
  }
  const target = byWorkspaceId ?? byEmail;
  return target
    ? { operation: "update" as const, userId: target.id }
    : { operation: "create" as const };
}

export function provisioningChangeRequiresSessionRevocation(input: {
  previousRole: UserRole;
  nextRole: UserRole;
  previouslyActive: boolean;
  nextActive: boolean;
}) {
  return input.previousRole !== input.nextRole || (input.previouslyActive && !input.nextActive);
}
