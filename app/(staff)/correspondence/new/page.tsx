import { CorrespondenceComposer } from "@/components/correspondence-composer";
import { canOriginate, canRegister } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function NewCorrespondencePage() {
  const user = await requireUser();
  if (!canOriginate(user.role)) return <div className="notice">You cannot raise correspondence.</div>;
  const isRegistrar = canRegister(user.role);
  return <>
    <span className="eyebrow">{isRegistrar ? "Secretariat intake or internal origination" : "Internal origination"}</span>
    <h1>Raise correspondence</h1>
    <p className="muted">Save unfinished work privately, then submit it through your formal reporting line when ready.</p>
    <CorrespondenceComposer userName={user.name} isRegistrar={isRegistrar} />
  </>;
}
