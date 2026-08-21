# Production assurance and pilot runbook

## Monitoring

Configure the platform liveness probe for `/api/health/live` and the readiness probe for `/api/health/ready`. Alert on repeated readiness 503 responses, worker failures, dead-letter email, quarantined/failed documents, expired evidence and assurance checks marked FAILED. Logs and alert destinations must be managed outside the application; do not place secrets or document contents in telemetry.

## Pre-pilot sequence

1. Deploy an immutable release to an isolated staging environment and apply migrations.
2. Run `npm run env:check`, `npm run test:assurance`, `npm run verify` and the approved security suite.
3. Connect real Workspace and S24B document services in staging.
4. Run production-like load tests, accessibility review, penetration testing and backup/restore drill.
5. Resolve findings and enter report/ticket references on `/admin/assurance`.
6. Train named DG Secretariat, Records, ICT and pilot business users using `docs/user-guide.md`.
7. Run a time-boxed pilot. Review audit, error, authorization, latency and adoption measures daily.
8. Obtain data-governance, security, records, ICT operations and business-owner acceptance.

## Pilot measures

Agree numeric targets before starting: successful registration rate, time to first action, overdue rate, dispatch completion, authentication failures, document-processing failures, p95 response time, support requests and authorization incidents. A severe security or data-integrity incident pauses the pilot.

## Release decision

Production release requires every required assurance item to be PASSED with current evidence. WAIVED is an explicit risk acceptance and must identify the accountable authority; use it only where policy permits. Any FAILED, BLOCKED, PENDING, expired or missing required item means no-go.

## Incident and rollback

Preserve correlation IDs, timestamps and affected record references without copying sensitive content into tickets. Contain access, stop affected workers if appropriate, preserve audit evidence, notify the named incident lead and follow the hosting rollback procedure. Database rollback is not a substitute for a forward-compatible migration plan.

## Recovery drill

Use a disposable isolated PostgreSQL target. Restore database and `storage/uploads`/managed document storage from the same recovery point, then reconcile attachment rows, file hashes and representative access controls. Record recovery time, recovery point, discrepancies and approval. The supplied script verifies PostgreSQL restoration only; document-store recovery must be tested through the selected production provider.
