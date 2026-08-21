import { randomUUID, timingSafeEqual } from "crypto";

export function correlationId(request: Request) { const supplied = request.headers.get("x-correlation-id")?.trim(); return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID(); }
export function serviceAuthorized(request: Request) { const configured = process.env.WORKSPACE_INTEROP_SECRET; const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); if (!configured || configured.length < 32 || !supplied) return false; const a = Buffer.from(configured); const b = Buffer.from(supplied); return a.length === b.length && timingSafeEqual(a, b); }
