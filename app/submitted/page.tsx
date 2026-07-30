import Link from "next/link";
import Image from "next/image";

export default async function SubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;
  return (
    <main className="hero-panel" style={{ minHeight: "100vh", maxWidth: 700, margin: "auto", textAlign: "center" }}>
      <Image className="hero-logo" src="/itf-logo.png" alt="Industrial Training Fund logo" width={112} height={112} priority style={{ marginInline: "auto" }} />
      <span className="eyebrow">Submission received</span>
      <h1 style={{ fontSize: "3rem" }}>Thank you.</h1>
      <p className="muted">Your correspondence has entered the ITF Secretariat intake queue.</p>
      <div className="card" style={{ margin: "20px 0" }}>
        <small className="muted">Reference number</small>
        <strong style={{ display: "block", fontSize: "1.5rem", marginTop: 8 }}>{reference}</strong>
      </div>
      <Link className="btn" href="/">Return to ITF Flow</Link>
    </main>
  );
}
