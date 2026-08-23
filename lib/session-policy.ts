export function effectiveSessionExpiry(
  now: Date,
  localMaximumSeconds: number,
  upstreamExpiresAt?: Date
) {
  const localExpiry = new Date(now.getTime() + localMaximumSeconds * 1000);
  if (!upstreamExpiresAt) return localExpiry;
  if (upstreamExpiresAt <= now) {
    throw new Error("The upstream Workspace session has expired.");
  }
  return upstreamExpiresAt < localExpiry ? upstreamExpiresAt : localExpiry;
}
