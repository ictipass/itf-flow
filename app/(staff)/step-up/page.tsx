import { stepUpAction } from "@/app/step-up-actions";

export default async function StepUpPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const params = await searchParams;
  return <><span className="eyebrow">Sensitive access</span><h1>Confirm your identity</h1><p className="muted">Secret correspondence requires a fresh password confirmation. Access remains elevated for 15 minutes on this signed session.</p>
    {params.error ? <p className="notice error">Password confirmation failed.</p> : null}
    <form action={stepUpAction} className="card grid" style={{ maxWidth: 560 }}><input type="hidden" name="returnTo" value={params.returnTo ?? "/inbox"} /><label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label><button className="btn" type="submit">Continue to Secret record</button></form></>;
}
