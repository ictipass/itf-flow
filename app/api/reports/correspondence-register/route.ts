import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { csvResponse, registryWhere, type RegistryParams } from "@/lib/correspondence-registry";
import { label } from "@/lib/reference";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const params = Object.fromEntries(new URL(request.url).searchParams) as RegistryParams;
  const records = await db.correspondence.findMany({
    where: registryWhere(user, params),
    include: {
      createdBy: true,
      secretariatRecord: true,
      workItems: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, include: { assignee: true }, orderBy: { assignedAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });
  return csvResponse([
    ["Reference", "Subject", "Sender", "Sender reference", "Type", "Classification", "Priority", "Status", "Current owner(s)", "Office(s)", "Department(s)", "Received", "Due", "Tracking code", "Physical location", "Originator"],
    ...records.map((record) => [record.referenceNumber, record.subject, record.senderName, record.senderReference, label(record.type), label(record.classification), label(record.priority), label(record.status), record.workItems.map((item) => item.assignee.name).join("; "), record.workItems.map((item) => item.assignee.office).join("; "), [...new Set(record.workItems.map((item) => item.assignee.department).filter(Boolean))].join("; "), record.receivedAt.toISOString(), record.dueAt?.toISOString(), record.secretariatRecord?.trackingCode, record.secretariatRecord?.currentLocation, record.createdBy?.name],),
  ], `itf-correspondence-register-${new Date().toISOString().slice(0, 10)}.csv`);
}
