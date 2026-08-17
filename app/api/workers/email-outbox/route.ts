import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/email-outbox";
import { hasValidBearerSecret } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!hasValidBearerSecret(request, process.env.EMAIL_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const configuredLimit = Number(process.env.EMAIL_WORKER_BATCH_SIZE ?? "20");
    const result = await processEmailOutbox(Number.isFinite(configuredLimit) ? configuredLimit : 20);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Email worker unavailable" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
