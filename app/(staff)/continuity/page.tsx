import { redirect } from "next/navigation";
import { setOwnAvailabilityAction } from "@/app/continuity-actions";
import { AvailabilityStatus } from "@/lib/generated/prisma/client";
import { continuityMembership, isCurrentlyAvailable } from "@/lib/office-continuity";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function ContinuityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const [plans, availability, params] = await Promise.all([
    continuityMembership(user.id),
    db.staffAvailability.findUnique({ where: { userId: user.id } }),
    searchParams,
  ]);
  if (!plans.length) redirect("/dashboard");
  const effectiveAvailable = isCurrentlyAvailable(availability);
  const errors: Record<string, string> = {
    validation: "Select an availability state and provide a reason of at least 10 characters.",
    unauthorized: "You are not assigned to an active continuity plan.",
    date: "The expected return date must be in the future.",
  };
  return <>
    <span className="eyebrow">My office continuity</span>
    <h1>Availability and next-in-line</h1>
    <p className="muted">Your setting affects new work and open, unacknowledged work. Acknowledged items remain with the officer who accepted custody so they are not silently moved mid-treatment.</p>
    {params.saved ? <p className="notice success">Availability saved. {params.moved ?? "0"} open item(s) were handed over automatically.</p> : null}
    {Number(params.stalled ?? 0) > 0 ? <p className="notice error">{params.stalled} item(s) could not be handed over because no eligible next-in-line officer was available. Contact the system administrator.</p> : null}
    {params.error && errors[params.error] ? <p className="notice error">{errors[params.error]}</p> : null}
    <section className="card">
      <h2>My current availability</h2>
      <p><span className="badge">{effectiveAvailable ? "Available" : "Unavailable"}</span>{availability?.unavailableUntil ? ` · expected return ${availability.unavailableUntil.toLocaleString("en-NG")}` : ""}</p>
      <form action={setOwnAvailabilityAction} className="form-grid">
        <label className="field"><span>Availability</span><select name="status" defaultValue={effectiveAvailable ? AvailabilityStatus.AVAILABLE : AvailabilityStatus.UNAVAILABLE}><option value={AvailabilityStatus.AVAILABLE}>Available</option><option value={AvailabilityStatus.UNAVAILABLE}>Unavailable</option></select></label>
        <label className="field"><span>Expected return (optional)</span><input type="datetime-local" name="unavailableUntil" /></label>
        <label className="field span-2"><span>Reason</span><textarea name="reason" required minLength={10} maxLength={500} placeholder="State the operational reason for this availability change." /></label>
        <button className="btn span-2" type="submit">Update availability</button>
      </form>
    </section>
    <section className="card" style={{ marginTop: 18 }}><h2>My continuity chains</h2>
      {plans.map((plan) => <div className="record-card" key={plan.id}>
        <strong>{plan.departmentName}</strong>
        <p className="muted">Director: {plan.director.name} ({isCurrentlyAvailable(plan.director.staffAvailability) ? "available" : "unavailable"}) · First: {plan.firstSuccessor.name} ({isCurrentlyAvailable(plan.firstSuccessor.staffAvailability) ? "available" : "unavailable"}) · Second: {plan.secondSuccessor.name} ({isCurrentlyAvailable(plan.secondSuccessor.staffAvailability) ? "available" : "unavailable"})</p>
        <small>Plan version {plan.version}. Approval authority: first {plan.firstCanApprove ? "enabled" : "not granted"}; second {plan.secondCanApprove ? "enabled" : "not granted"}.</small>
      </div>)}
    </section>
  </>;
}
