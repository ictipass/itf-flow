import Link from "next/link";
import { loginAction } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="hero">
      <section className="hero-copy">
        <span className="eyebrow" style={{ color: "#e1bd55" }}>ITF Workspace child application</span>
        <h1 style={{ fontSize: "4.5rem" }}>Staff<br />access</h1>
        <p>Use the local demo accounts below or launch ITF Flow from the Workspace.</p>
      </section>
      <section className="hero-panel">
        <h2>Sign in to ITF Flow</h2>
        {error ? <p className="notice">The sign-in or Workspace handoff could not be completed.</p> : null}
        <form action={loginAction} className="grid" style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="email">ITF email</label>
            <input id="email" name="email" type="email" placeholder="name@itf.gov.ng" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="Enter your password" required />
          </div>
          <button className="btn" type="submit">Sign in</button>
        </form>
        <p className="muted" style={{ marginTop: 18 }}>
          Demo password: <strong>Demo123!</strong>
        </p>
        <Link href="/" className="muted">← Return home</Link>
      </section>
    </main>
  );
}
