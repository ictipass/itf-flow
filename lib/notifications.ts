import { NotificationType } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export type NotificationDelivery = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  sourceType: string;
  sourceId: string;
  emailSubject?: string;
  emailBody?: string;
};

export async function enqueueNotifications(tx: TransactionClient, deliveries: NotificationDelivery[]) {
  const unique = deliveries.filter((delivery, index) => deliveries.findIndex((candidate) =>
    candidate.userId === delivery.userId && candidate.type === delivery.type &&
    candidate.sourceType === delivery.sourceType && candidate.sourceId === delivery.sourceId,
  ) === index);
  if (!unique.length) return;
  const users = await tx.user.findMany({
    where: { id: { in: unique.map((delivery) => delivery.userId) }, isActive: true },
    select: { id: true, email: true },
  });
  const emailByUser = new Map(users.map((user) => [user.id, user.email]));
  const valid = unique.filter((delivery) => emailByUser.has(delivery.userId));
  if (!valid.length) return;
  await tx.notification.createMany({
    data: valid.map((delivery) => ({
      userId: delivery.userId, actorId: delivery.actorId, type: delivery.type,
      title: delivery.title, message: delivery.message, href: delivery.href,
      sourceType: delivery.sourceType, sourceId: delivery.sourceId,
    })),
    skipDuplicates: true,
  });
  await tx.emailOutbox.createMany({
    data: valid.map((delivery) => ({
      idempotencyKey: `${delivery.sourceType}:${delivery.sourceId}:${delivery.type}:${delivery.userId}`,
      userId: delivery.userId,
      toAddress: emailByUser.get(delivery.userId)!,
      subject: delivery.emailSubject ?? delivery.title,
      textBody: delivery.emailBody ?? `${delivery.message}\n\nOpen ITF Flow: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}${delivery.href}`,
      sourceType: delivery.sourceType,
      sourceId: delivery.sourceId,
    })),
    skipDuplicates: true,
  });
}
