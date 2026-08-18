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
    select: { referenceNumber: true, subject: true, events: { include: { actor: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });
  return csvResponse([
    ["Reference", "Subject", "Event", "From status", "To status", "Actor", "Role", "Office", "Minute", "Date/time"],
    ...records.flatMap((record) => record.events.map((event) => [record.referenceNumber, record.subject, label(event.type), event.fromStatus ? label(event.fromStatus) : "", event.toStatus ? label(event.toStatus) : "", event.actor?.name ?? label(event.actorType), event.actor ? label(event.actor.role) : "", event.actor?.office, event.minute, event.createdAt.toISOString()])),
  ], `itf-movement-register-${new Date().toISOString().slice(0, 10)}.csv`);
}
