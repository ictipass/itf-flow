import { UserRole } from "@/lib/generated/prisma/client";

export type AnnotationAuthenticationPolicy = {
  annotationMfaRequiredForDg: boolean;
  annotationMfaRequiredForDirectors: boolean;
  annotationMfaRequiredForDivisionHeads: boolean;
};

export function annotationStrongAuthenticationRequired(
  role: UserRole,
  policy: AnnotationAuthenticationPolicy,
) {
  if (role === UserRole.DG) return policy.annotationMfaRequiredForDg;
  if (role === UserRole.DIRECTOR) return policy.annotationMfaRequiredForDirectors;
  if (role === UserRole.DIVISION_HEAD) return policy.annotationMfaRequiredForDivisionHeads;
  return true;
}

export async function annotationAuthenticationPolicyFor(role: UserRole) {
  const { getApplicationConfiguration } = await import("@/lib/appearance");
  const configuration = await getApplicationConfiguration();
  return {
    required: annotationStrongAuthenticationRequired(role, configuration),
    configurationVersion: configuration.version,
  };
}
