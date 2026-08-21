import { NextResponse } from "next/server";
import { processPendingDocuments } from "@/lib/document-processing";
import { hasValidBearerSecret } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!hasValidBearerSecret(request, process.env.DOCUMENT_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const configured = Number(process.env.DOCUMENT_WORKER_BATCH_SIZE ?? "10"); const result = await processPendingDocuments(Number.isFinite(configured) ? configured : 10); return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Document worker unavailable" }, { status: 503 }); }
}

export async function GET() { return NextResponse.json({ error: "Method not allowed" }, { status: 405 }); }
