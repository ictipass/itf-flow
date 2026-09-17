// Only allow-listed categories leave this boundary. Never log Error.message, tokens or identities.
export type WorkspaceLaunchFailureStage = "VERIFY_TOKEN" | "PROVISIONING" | "REDEMPTION" | "CREATE_SESSION";
export class WorkspaceLaunchFailure extends Error {
  constructor(public readonly code: "USER_NOT_PROVISIONED" | "USER_INACTIVE" | "ROLE_MISMATCH" | "IDENTITY_CONFLICT" | "ROLE_UNSUPPORTED") {
    super(code);
  }
}

export function classifyWorkspaceLaunchFailure(error: unknown, stage: WorkspaceLaunchFailureStage): string {
  if (error instanceof WorkspaceLaunchFailure) return error.code;
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (stage === "REDEMPTION" && code === "P2002") return "TOKEN_REPLAYED";
  if (["P1001", "P1002", "P1008", "P1017", "P2024", "P2028"].includes(code)) return "DATABASE_UNAVAILABLE";
  if (stage === "VERIFY_TOKEN" && error instanceof Error) {
    const known: Record<string, string> = {
      "Workspace launch signing key is unknown or invalid.": "SIGNING_KEY_UNKNOWN",
      "Invalid Workspace launch token signature.": "SIGNATURE_INVALID",
      "Workspace launch claims are invalid.": "CLAIMS_INVALID",
      "Workspace launch timing is invalid.": "TIMING_INVALID",
      "Fresh Workspace TOTP is required for this sensitive entitlement.": "ASSURANCE_REQUIRED",
      "Workspace signing keys are unavailable.": "JWKS_UNAVAILABLE",
      "Workspace signing key response is invalid.": "JWKS_RESPONSE_INVALID",
      "Invalid Workspace launch token structure.": "TOKEN_MALFORMED",
      "Workspace launch token header is not allowed.": "HEADER_INVALID",
    };
    if (known[error.message]) return known[error.message];
    if (/^WORKSPACE_(LAUNCH_|APP_SLUG|MFA_STEP_UP)/.test(error.message)) return "RECEIVER_CONFIGURATION_INVALID";
    return "TOKEN_VERIFICATION_FAILED";
  }
  return stage === "CREATE_SESSION" ? "SESSION_CREATION_FAILED" : "PROVISIONING_FAILED";
}

export function validWorkspaceLaunchReference(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
