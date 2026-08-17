import { createHash, timingSafeEqual } from "crypto";

export function hasValidBearerSecret(request: Request, configured: string | undefined) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || configured.length < 32 || !supplied) return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expected, actual);
}
