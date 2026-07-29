import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

export async function getPermittedActionRecipientIds(userId: string, role: UserRole) {
  if (role === UserRole.SYSTEM_ADMIN) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      supervisorId: true,
      directReports: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  if (!user) return [];
  return [
    ...(user.supervisorId ? [user.supervisorId] : []),
    ...user.directReports.map((report) => report.id),
  ];
}

export async function actionRecipientsFollowReportingLine(input: {
  actorId: string;
  actorRole: UserRole;
  recipientIds: string[];
}) {
  const permittedIds = await getPermittedActionRecipientIds(input.actorId, input.actorRole);
  if (permittedIds === null) return true;
  const permitted = new Set(permittedIds);
  return input.recipientIds.every((id) => permitted.has(id));
}
