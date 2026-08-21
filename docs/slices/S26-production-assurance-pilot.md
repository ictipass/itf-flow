# S26 — Production assurance, observability and controlled pilot

## Practical implication

ICT can distinguish an application process that is alive from one whose required dependencies are reachable. Administrators have one evidence register for security, performance, recovery, governance and pilot decisions. ITF Flow does not declare itself production-ready merely because it builds or starts.

## Delivered

- `GET /api/health/live`: shallow liveness check with no sensitive configuration details.
- `GET /api/health/ready`: database readiness check, correlation ID and safe 503 response.
- Production assurance dashboard at `/admin/assurance`, restricted to system administrators.
- Persistent required-control register and operational-event trail.
- Explicit production configuration checks for secrets and real document providers.
- Authorization regression tests and a bounded, read-only health load-smoke tool.
- Isolated PostgreSQL backup/restore verification script with a same-database refusal guard.
- Production assurance and pilot runbooks.

## Important boundary

S26 supplies the controls and repeatable procedures; it does not fabricate external evidence. Penetration testing, production-like load testing, a real backup restore, accessibility review, governance approval, controlled pilot and sign-off remain pending until accountable people perform and record them. S24B also remains blocked until EDMS, malware-scanner and OCR contracts/test services exist.

## Operator commands

```powershell
npm run test:assurance
npm run load:smoke
$env:BACKUP_SOURCE_DATABASE_URL = "postgresql://...source..."
$env:BACKUP_VERIFY_DATABASE_URL = "postgresql://...disposable-verification-db..."
npm run backup:verify
```

Never point `BACKUP_VERIFY_DATABASE_URL` at production or any database whose data must be retained. Save approved test outputs in the organization evidence repository and record only the evidence reference in ITF Flow.

## Acceptance

- Liveness remains independent of PostgreSQL.
- Readiness returns 503 without leaking an exception when PostgreSQL is unavailable.
- Only a system administrator can maintain assurance evidence.
- A production-ready result requires all required checks to be current and all configuration gaps resolved.
- Load smoke performs GET requests only and fails on HTTP errors or the agreed p95 threshold.
- Restore verification refuses identical source and target URLs.
