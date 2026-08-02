import { notFound, redirect } from "next/navigation";
import { BroadcastStatus } from "@/lib/generated/prisma/client";
import { BroadcastComposer } from "@/components/broadcast-composer";
import { getBroadcastComposerData } from "@/lib/broadcasts";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

function localInput(date: Date | null) {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function EditBroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const broadcast = await db.broadcast.findUnique({ where: { id }, include: { audiences: true } });
  if (!broadcast) notFound();
  if (broadcast.createdById !== user.id || broadcast.status !== BroadcastStatus.DRAFT) redirect(`/broadcasts/${id}`);
  const composer = await getBroadcastComposerData(user.id);
  return <><span className="eyebrow">Draft broadcast</span><h1>Edit broadcast</h1><BroadcastComposer options={composer.options} categories={composer.categories} canRequireAcknowledgement={composer.canRequireAcknowledgement} initial={{ id: broadcast.id, title: broadcast.title, message: broadcast.message, category: broadcast.category, priority: broadcast.priority, publishAt: localInput(broadcast.publishAt), expiresAt: localInput(broadcast.expiresAt), mandatoryAcknowledgement: broadcast.mandatoryAcknowledgement, audiences: broadcast.audiences.map((audience) => ({ scopeType: audience.scopeType, scopeValue: audience.scopeValue ?? "" })) }} /></>;
}
