# S31A2 — Stylus annotation, reliable in-app rendering and routing-minute reuse

Status: **Implemented; migration and deployment pending**

Implementation commit: `904d7d3`

## Outcome

The annotation workspace no longer frames the protected attachment route. It renders PDF pages locally with PDF.js
and supplies a transparent drawing layer that accepts a hardware stylus, touch input or a mouse. JPEG and PNG scans
use the same page-and-ink workflow. Saving creates a new immutable PDF version containing the visual ink and the
existing authenticated Flow signing block.

The typed minute is optional when ink is present. After the current action holder saves an annotation on the current
included document version, **Minute / instruction** may also be left blank during routing. The server reuses that
actor's current annotation minute; it does not accept an older, superseded or another actor's annotation.

## Controls

- The protected attachment is fetched through the existing authorized route; the global `X-Frame-Options: DENY`
  protection remains unchanged.
- The server accepts only a valid PNG data URL, limits decoded ink to 4 MB and verifies its file signature.
- The canonical signed annotation payload and database record retain `inputMethod` and the SHA-256 ink hash.
- At least typed text or visual ink is mandatory. An ink-only record receives a bounded searchable audit description.
- The original attachment remains immutable; ink is embedded only in the generated PDF version.
- Routing-minute reuse is authorized server-side and requires the annotation signer to be the current user and its
  output attachment to remain the included document version.
- Stylus ink is visual handwriting, not a certificate-backed or qualified electronic signature. Existing identity,
  re-authentication, delegation, integrity and policy evidence remains the authoritative Flow signing evidence.

## Data and dependencies

Migration `20260927200000_add_document_annotation_ink` adds `inputMethod` and `inkSha256` to
`DocumentAnnotation`. Deploy it before releasing the application build.

`pdfjs-dist` 4.10.38 is pinned for the current Node 20-compatible application baseline. It is an open-source
application dependency and does not introduce a SaaS subscription or a new environment variable.

## Verification

- 59 assurance tests pass, including accepted input combinations, invalid ink rejection, generated-PDF ink embedding
  and safe routing feedback.
- `npm run verify` passes Prisma validation, generated route/type checking, ESLint and the optimized 44-route build.

## Deployment acceptance

1. Run `npm run db:migrate` against staging and deploy commit `904d7d3` or a later commit containing it.
2. Open an available multi-page PDF and confirm page navigation and rendering without a refused-connection panel.
3. Test pen input on at least one supported stylus device and test touch/mouse fallback.
4. Save text-only, ink-only and combined annotations; download each generated PDF and inspect the selected page.
5. Route with a blank minute after annotating the current version and confirm the annotation appears in movement
   history. Confirm a different actor or an older superseded annotation cannot bypass the required routing minute.
6. Recheck Confidential/Secret access, delegated authority and both enforced and relaxed annotation-authentication
   policies.

## Next boundary

The next document-signing slice is governed reusable signature profiles/memo output and, if ITF requires it,
certificate-backed PAdES. More advanced movable/resizable markup, erasing individual strokes and retaining unsaved
ink while switching pages are usability extensions, not part of this increment.
