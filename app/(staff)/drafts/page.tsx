import Link from "next/link";
import { CorrespondenceStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function DraftsPage() {
  const user = await requireUser();
  const drafts = await db.correspondence.findMany({ where: { createdById: user.id, status: CorrespondenceStatus.DRAFT }, orderBy: { updatedAt: "desc" } });
  return <><span className="eyebrow">Private working copies</span><h1>My drafts</h1><p className="muted">Drafts are visible only to you until submitted.</p><div className="card"><table className="table"><thead><tr><th>Subject</th><th>Type</th><th>Last saved</th><th></th></tr></thead><tbody>
    {drafts.map((draft) => <tr key={draft.id}><td><strong>{draft.subject || "Untitled correspondence"}</strong></td><td>{draft.type.replaceAll("_", " ")}</td><td>{draft.updatedAt.toLocaleString("en-NG")}</td><td><Link className="btn compact" href={`/correspondence/${draft.id}/edit`}>Continue</Link></td></tr>)}
    {!drafts.length ? <tr><td colSpan={4} className="muted">You have no saved drafts.</td></tr> : null}
  </tbody></table></div></>;
}
