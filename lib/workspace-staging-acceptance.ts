import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;
function utcExpiry(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ? Date.parse(value) : NaN;
}
export function stagingAcceptanceConfigurationIssues(environment: Environment = process.env) {
  const issues: string[] = [];
  const enabled = environment.WORKSPACE_STAGING_ACCEPTANCE_ENABLED;
  if (enabled && enabled !== "true" && enabled !== "false") issues.push("WORKSPACE_STAGING_ACCEPTANCE_ENABLED must be true or false.");
  if (enabled === "true") {
    if (environment.ITF_FLOW_DEPLOYMENT_STAGE !== "staging") issues.push("Staging acceptance requires ITF_FLOW_DEPLOYMENT_STAGE=staging in the dedicated staging project.");
    if (!environment.WORKSPACE_STAGING_ACCEPTANCE_USER_ID?.trim() || environment.WORKSPACE_STAGING_ACCEPTANCE_USER_ID.trim().length > 200) issues.push("Staging acceptance requires one bounded Workspace test-user ID.");
    const expiry = utcExpiry(environment.WORKSPACE_STAGING_ACCEPTANCE_EXPIRES_AT);
    if (!Number.isFinite(expiry)) issues.push("Staging acceptance requires a valid UTC expiry timestamp.");
    if (expiry > Date.now() + 24 * 60 * 60_000) issues.push("Staging acceptance expiry must be within 24 hours.");
  }
  return issues;
}
export function stagingAcceptanceTarget(environment: Environment = process.env, now = new Date()) {
  const userId = environment.WORKSPACE_STAGING_ACCEPTANCE_USER_ID?.trim();
  const expiry = utcExpiry(environment.WORKSPACE_STAGING_ACCEPTANCE_EXPIRES_AT);
  if (environment.ITF_FLOW_DEPLOYMENT_STAGE !== "staging" ||
      environment.WORKSPACE_STAGING_ACCEPTANCE_ENABLED !== "true" || !userId || userId.length > 200 ||
      !Number.isFinite(expiry) || expiry <= now.getTime() || expiry > now.getTime() + 24 * 60 * 60_000) return null;
  return userId;
}
export const stagingObservationRequest = z.object({
  workspaceUserId: z.string().min(1).max(200), eventId: z.uuid().optional(),
}).strict();
export function allowedStagingEvent(event: { workspaceUserId: string; reason: string }, environment: Environment = process.env) {
  return event.workspaceUserId === stagingAcceptanceTarget(environment) &&
    /^STAGING_A01_(06|07):[0-9a-f-]{36}$/.test(event.reason);
}
