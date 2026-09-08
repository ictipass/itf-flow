import Link from "next/link";
import Image from "next/image";
import { resolveWorkspaceNavigationUrls } from "@/lib/workspace-navigation-urls";

export default function HomePage() {
  const { workspaceLoginUrl } = resolveWorkspaceNavigationUrls();
  return (
    <main className="hero">
      <section className="hero-copy">
        <Image className="hero-logo" src="/itf-logo.png" alt="Industrial Training Fund logo" width={112} height={112} priority />
        <span className="eyebrow" style={{ color: "white" }}>Industrial Training Fund</span>
        <h1>ITF<br />Flow</h1>
        <p>
          Secure correspondence intake, hierarchical routing, shared minutes,
          accountable action and a complete institutional record.
        </p>
      </section>
      <section className="hero-panel">
        <span className="eyebrow">Correspondence & workflow</span>
        <h2 style={{ fontSize: "2.35rem", marginBottom: 10 }}>Move work with clarity.</h2>
        <p className="muted" style={{ lineHeight: 1.7 }}>
          Organizations can submit letters directly. ITF staff access their assigned
          correspondence through the ITF Workspace.
        </p>
        <div className="actions">
          <Link className="btn" href="/portal/login">Stakeholder portal</Link>
          <Link className="btn secondary" href="/submit">One-time submission</Link>
          <a className="btn" href={workspaceLoginUrl}>Staff sign in through Workspace</a>
          <Link className="btn secondary" href="/login">Staff access help</Link>
        </div>
      </section>
    </main>
  );
}
