import { NextResponse } from "next/server";
import { getCurrentStaffSession } from "@/lib/session";
import { fetchWorkspaceAppNavigation } from "@/lib/workspace-app-navigation";

export const runtime = "nodejs";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET() {
  const session = await getCurrentStaffSession();
  if (!session) return response({ error: "Unauthenticated" }, 401);
  if (!session.user.workspaceUserId || !session.workspaceSessionId) {
    return response({ error: "Workspace-launched session required." }, 403);
  }

  try {
    return response(
      await fetchWorkspaceAppNavigation({
        workspaceUserId: session.user.workspaceUserId,
        workspaceSessionId: session.workspaceSessionId,
      })
    );
  } catch {
    return response({ error: "Application list is temporarily unavailable." }, 503);
  }
}
