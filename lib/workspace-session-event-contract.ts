import { z } from "zod";

export const WORKSPACE_SESSION_EVENT_VERSION = "itf-workspace-session-event-v1" as const;

const commonEventSchema = z.object({
  version: z.literal(WORKSPACE_SESSION_EVENT_VERSION),
  eventId: z.string().uuid(),
  workspaceUserId: z.string().min(1).max(200),
  targetAppSlug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  occurredAt: z.iso.datetime({ offset: true }),
  reason: z.string().min(3).max(500),
});

export const workspaceSessionEventSchema = z.discriminatedUnion("type", [
  commonEventSchema.extend({
    type: z.literal("CENTRAL_LOGOUT"),
    workspaceSessionId: z.string().min(1).max(200),
  }),
  commonEventSchema.extend({
    type: z.literal("ENTITLEMENT_REVOKED"),
    workspaceSessionId: z.undefined().optional(),
  }),
]);

export type WorkspaceSessionEvent = z.infer<typeof workspaceSessionEventSchema>;

export function sessionRevocationSelector(
  userId: string,
  event: WorkspaceSessionEvent
) {
  return {
    userId,
    revokedAt: null,
    ...(event.type === "CENTRAL_LOGOUT"
      ? { workspaceSessionId: event.workspaceSessionId }
      : {}),
  };
}
