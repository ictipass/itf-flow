import Link from "next/link";
import Image from "next/image";
import { loginAction } from "@/app/actions";
import { localStaffLoginEnabled } from "@/lib/authentication-policy";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const localEnabled = localStaffLoginEnabled();
  return (
    <main className="hero">
      <section className="hero-copy">
        <Image className="hero-logo" src="/itf-logo.png" alt="Industrial Training Fund logo" width={112} height={112} priority />
        <span className="eyebrow" style={{ color: "white" }}>ITF Workspace child application</span>
        <h1 style={{ fontSize: "4.5rem" }}>Staff<br />access</h1>
        <p>{localEnabled ? "Use a local demonstration account or launch ITF Flow from Workspace." : "Launch ITF Flow from ITF Workspace using your enterprise account."}</p>
      </section>
      <section className="hero-panel">
        <h2>Sign in to ITF Flow</h2>
        {error ? <p className="notice">The sign-in or Workspace handoff could not be completed.</p> : null}
        {localEnabled ? <form action={loginAction} className="grid" style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="email">ITF email</label>
            <input id="email" name="email" type="email" placeholder="name@itf.gov.ng" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="Enter your password" required />
          </div>
          <button className="btn" type="submit">Sign in</button>
        </form> : <p className="notice" style={{ marginTop: 20 }}>Local staff-password login is disabled in this environment. Open ITF Flow from Workspace.</p>}
        {localEnabled ? <p className="muted" style={{ marginTop: 18 }}>
          Demo password: <strong>Demo123!</strong>
        </p> : null}
        <Link href="/" className="muted">← Return home</Link>
      </section>
    </main>
  );
}
