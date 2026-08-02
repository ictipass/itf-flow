import { redirect } from "next/navigation";
import { BroadcastComposer } from "@/components/broadcast-composer";
import { getBroadcastComposerData } from "@/lib/broadcasts";
import { requireUser } from "@/lib/session";

export default async function NewBroadcastPage() {
  const user = await requireUser();
  const composer = await getBroadcastComposerData(user.id);
  if (!composer.grants.length) redirect("/broadcasts");
  return <><span className="eyebrow">Organizational communication</span><h1>Create broadcast</h1><p className="muted">Publish to only the organizational scopes covered by your explicit grant.</p><BroadcastComposer options={composer.options} categories={composer.categories} canRequireAcknowledgement={composer.canRequireAcknowledgement} /></>;
}
