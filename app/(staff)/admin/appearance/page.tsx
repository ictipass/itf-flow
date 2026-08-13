import { redirect } from "next/navigation";
import { Check, Eye, History, LayoutDashboard, PanelLeft, RotateCcw, Sparkles } from "lucide-react";
import { activateStaffUiAction, clearStaffUiPreviewAction, previewStaffUiAction } from "@/app/appearance-actions";
import { StaffUiMode, UserRole } from "@/lib/generated/prisma/client";
import { getApplicationConfiguration, UI_PREVIEW_COOKIE } from "@/lib/appearance";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export default async function AppearancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const query = await searchParams;
  const [configuration, history] = await Promise.all([
    getApplicationConfiguration(),
    db.configurationChange.findMany({ where: { setting: "staffUiMode" }, include: { changedBy: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const previewMode = (await cookies()).get(UI_PREVIEW_COOKIE)?.value;

  return <>
    <div className="section-heading appearance-heading">
      <div><span className="eyebrow">System administration</span><h1>Staff experience</h1><p className="muted">Preview and activate the interface used by all ITF Flow staff. Workflow behavior and permissions remain unchanged.</p></div>
      <div className="appearance-current"><small>Active organization-wide</small><strong><Check size={17} /> {configuration.staffUiMode === StaffUiMode.CLASSIC ? "Classic" : "Modern"}</strong></div>
    </div>

    {query.updated ? <p className="notice success">The organization-wide staff experience was updated successfully.</p> : null}
    {query.error === "validation" ? <p className="notice error">Choose a mode and provide a reason of at least 10 characters.</p> : null}
    {query.error === "stale" ? <p className="notice error">Another administrator changed this setting. Review the current selection and try again.</p> : null}
    {query.error === "unchanged" ? <p className="notice">That interface is already active.</p> : null}
    {previewMode ? <div className="appearance-preview-notice"><div><Eye size={20} /><span><strong>Your private preview is active.</strong><small>Other staff still see the organization-wide selection.</small></span></div><form action={clearStaffUiPreviewAction}><button className="btn secondary compact" type="submit">Exit preview</button></form></div> : null}

    <section className="appearance-options" aria-label="Available staff interfaces">
      <AppearanceOption
        mode={StaffUiMode.CLASSIC}
        title="Classic"
        description="The familiar ITF Flow sidebar and table-led dashboard. Retained as the safe fallback."
        features={["Permanent full navigation", "Current command centre", "Existing page density"]}
        active={configuration.staffUiMode === StaffUiMode.CLASSIC}
        version={configuration.version}
        icon={<PanelLeft size={25} />}
      />
      <AppearanceOption
        mode={StaffUiMode.MODERN}
        title="Modern"
        description="A compact navigation rail and bento-style command workspace focused on attention and movement."
        features={["Compact responsive workspace", "Attention-first dashboard", "Activity and quick-action panels"]}
        active={configuration.staffUiMode === StaffUiMode.MODERN}
        version={configuration.version}
        icon={<Sparkles size={25} />}
        featured
      />
    </section>

    <section className="card appearance-history">
      <div className="modern-panel-heading"><div><span className="eyebrow">Audit trail</span><h2><History size={20} /> Recent changes</h2></div></div>
      {history.length ? <div className="appearance-history-list">{history.map((change) => <article key={change.id}><span className="appearance-history-icon"><LayoutDashboard size={17} /></span><div><strong>{change.previousValue} → {change.newValue}</strong><p>{change.reason}</p><small>{change.changedBy.name} · {change.createdAt.toLocaleString("en-NG")}</small></div></article>)}</div> : <p className="muted">No interface changes have been recorded. Classic remains the migration default.</p>}
    </section>
  </>;
}

function AppearanceOption({ mode, title, description, features, active, version, icon, featured = false }: {
  mode: StaffUiMode;
  title: string;
  description: string;
  features: string[];
  active: boolean;
  version: number;
  icon: React.ReactNode;
  featured?: boolean;
}) {
  return <article className={`appearance-option ${featured ? "featured" : ""}`}>
    <div className="appearance-option-preview" aria-hidden="true">
      <span className="appearance-preview-rail">{icon}</span>
      <span className="appearance-preview-body"><i /><b /><b /><b /><em /></span>
    </div>
    <div className="appearance-option-copy">
      <div className="appearance-option-title"><span>{icon}</span><div><h2>{title}</h2>{active ? <small><Check size={13} /> Currently active</small> : null}</div></div>
      <p>{description}</p>
      <ul>{features.map((feature) => <li key={feature}><Check size={14} /> {feature}</li>)}</ul>
    </div>
    <div className="appearance-option-actions">
      <form action={previewStaffUiAction}><input type="hidden" name="mode" value={mode} /><button className="btn secondary" type="submit"><Eye size={16} /> Preview privately</button></form>
      {!active ? <form action={activateStaffUiAction} className="appearance-activate-form">
        <input type="hidden" name="mode" value={mode} /><input type="hidden" name="version" value={version} />
        <label htmlFor={`reason-${mode}`}>Reason for organization-wide change</label>
        <textarea id={`reason-${mode}`} name="reason" minLength={10} maxLength={500} required placeholder="Record the stakeholder decision or rollout reason…" />
        <button className="btn" type="submit">{mode === StaffUiMode.CLASSIC ? <RotateCcw size={16} /> : <Sparkles size={16} />} Activate {title}</button>
      </form> : null}
    </div>
  </article>;
}
