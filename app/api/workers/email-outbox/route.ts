import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/email-outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const configured = process.env.EMAIL_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || configured.length < 32 || !supplied) return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
