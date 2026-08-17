import { NextResponse } from "next/server";
import { processWorkflowReminders } from "@/lib/reminders";
import { hasValidBearerSecret } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!hasValidBearerSecret(request, process.env.WORKFLOW_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await processWorkflowReminders(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Workflow automation unavailable" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
