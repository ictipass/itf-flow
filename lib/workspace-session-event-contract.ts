import { z } from "zod";

export const WORKSPACE_SESSION_EVENT_VERSION = "itf-workspace-session-event-v1" as const;

export const workspaceSessionEventSchema = z.object({
  version: z.literal(WORKSPACE_SESSION_EVENT_VERSION),
  eventId: z.string().uuid(),
  type: z.enum(["CENTRAL_LOGOUT", "ENTITLEMENT_REVOKED"]),
  workspaceUserId: z.string().min(1).max(200),
  workspaceSessionId: z.string().min(1).max(200).optional(),
  targetAppSlug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  occurredAt: z.iso.datetime({ offset: true }),
  reason: z.string().min(3).max(500),
});

export type WorkspaceSessionEvent = z.infer<typeof workspaceSessionEventSchema>;

export function sessionRevocationSelector(
  userId: string,
  event: WorkspaceSessionEvent
) {
  return {
    userId,
    revokedAt: null,
    ...(event.workspaceSessionId
      ? { workspaceSessionId: event.workspaceSessionId }
      : {}),
  };
}
