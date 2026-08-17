import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { canRegister } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function SecretariatLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canRegister(user.role)) notFound();
  const { id } = await params;
  const record = await db.secretariatRecord.findUnique({ where: { correspondenceId: id }, include: { correspondence: true } });
  if (!record) notFound();
  const destination = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/correspondence/${id}`;
  const qr = await QRCode.toDataURL(destination, { errorCorrectionLevel: "M", margin: 1, width: 260, color: { dark: "#171717", light: "#ffffff" } });
  return <div className="label-page">
    <div className="label-toolbar"><Link className="btn secondary" href={`/correspondence/${id}`}>Back to correspondence</Link><p className="muted">Use the browser print command to print this label.</p></div>
    <section className="tracking-label">
      <div><span className="eyebrow">Industrial Training Fund</span><h1>Physical correspondence file</h1><strong>{record.trackingCode}</strong><p>{record.correspondence.referenceNumber}</p><p>{record.correspondence.subject}</p><small>Scan to open the controlled ITF Flow record. Authentication and authorization are still required.</small></div>
      <Image src={qr} width={260} height={260} alt={`QR code for ${record.trackingCode}`} unoptimized />
      <footer><span>Pages: {record.pageCount}</span><span>Location: {record.currentLocation}</span><span>Scanned: {record.scannedAt.toLocaleDateString("en-NG")}</span></footer>
    </section>
  </div>;
}
