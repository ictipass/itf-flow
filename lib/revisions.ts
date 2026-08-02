import { db } from "@/lib/db";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export async function captureRevision(
  tx: TransactionClient,
  correspondenceId: string,
  createdById: string | null,
  changeNote: string,
) {
  const [record, latest] = await Promise.all([
    tx.correspondence.findUniqueOrThrow({
      where: { id: correspondenceId },
      include: { attachments: { orderBy: { createdAt: "asc" } } },
    }),
    tx.correspondenceRevision.aggregate({ where: { correspondenceId }, _max: { version: true } }),
  ]);
  const version = (latest._max.version ?? 0) + 1;
  return tx.correspondenceRevision.create({
    data: {
      correspondenceId,
      version,
      subject: record.subject,
      summary: record.summary,
      body: record.body,
      classification: record.classification,
      priority: record.priority,
      senderReference: record.senderReference,
      dueAt: record.dueAt,
      attachments: record.attachments.map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        sha256: attachment.sha256,
      })),
      changeNote,
      createdById,
    },
  });
}
