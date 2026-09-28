# S30 — Governed reusable signature profiles and ITF memo output

Status: **Implemented; migration, policy and staging acceptance pending**

Implementation commit: `ef99432`

## Outcome

Every active staff user can submit a versioned PNG image of their own signature from **Signature profile**. The image
cannot be used until a system administrator reviews the latest submission and records an approval reason. Rejection,
replacement, supersession and revocation remain visible history.

Once an internal memo reaches `RESOLVED` or `CLOSED`, an authorized correspondence participant or records role can
generate a versioned ITF memo PDF. The output contains the memo content, the originator’s approved visual signature,
routing chain, movement/minute history, decisions, current revision and the included-document hash manifest.

## Signature governance

- PNG only, maximum 1 MB, bounded dimensions and server-side file-signature/header/decoder validation.
- A mandatory ownership/use attestation is stored with every submission.
- Only a system administrator can approve, reject or revoke, and every review needs a reason of at least 10 characters.
- Only the latest submitted profile version can be reviewed. Approving a replacement supersedes the earlier approved
  version for future output without deleting it.
- Revocation stops future output generation with that profile. Historical outputs retain the exact profile version
  and signature hash used when they were generated.
- Profile image routes are restricted to the owner and system administrators.

## Memo-output controls

- Output is limited to resolved/closed `INTERNAL_MEMO` correspondence.
- Server-side access repeats participant/broad-role, need-to-know and Secret step-up checks.
- Generation fails safely when the originator lacks an approved signature profile.
- The renderer uses the latest correspondence revision and produces a new immutable output version; it does not
  replace correspondence attachments or mutate the revision.
- The database retains output storage metadata, SHA-256, revision, originator, generator, approved profile and
  template version. A signed canonical payload binds those fields together.
- Download rechecks both the HMAC-backed canonical record and stored PDF hash. Sensitive downloads use the existing
  access log and controlled filename behavior.
- The output is stored by the configured document provider and therefore works with local development storage or
  private Vercel Blob without another provider or environment variable.

## Data and deployment

Migration `20260928120000_add_signature_profiles_and_memo_outputs` adds `SignatureProfile`, `MemoOutput`,
`SignatureProfileStatus`, their relations and the `MEMO_OUTPUT_GENERATED` event.

No new paid service is introduced. Signature bytes are small governed profile data in PostgreSQL; generated PDFs use
the configured document store. Existing `pdf-lib` rendering and application HMAC controls are used. If ITF later
requires a signature verifiable outside Flow, a certificate authority, managed signing key/HSM and trusted timestamp
service remain separate dependencies.

## Verification

- 62 assurance tests pass, including bounded PNG validation, PNG decoding and parseable multi-page lifecycle output.
- `npm run verify` passes Prisma validation, generated route/type checking, ESLint and the optimized 46-route build.

## Staging acceptance

1. Apply the migration and deploy `ef99432` or a later commit containing it.
2. Submit a transparent PNG from a normal staff account; confirm it remains pending and cannot be used.
3. Approve it as system administrator with an audit reason; test rejection, replacement and revocation paths.
4. Resolve an internal memo raised by that user and generate the output from another authorized participant.
5. Inspect the PDF layout, signature, movement/minutes, decisions and document hashes against the live record.
6. Generate a second output and verify both versions remain downloadable with successful integrity indicators.
7. Revoke the current signature, confirm future generation is blocked and confirm the historical output remains valid.
8. Repeat with Confidential and Secret test records to validate need-to-know and step-up controls.

## Policy boundary and next slice

Management/Legal must approve the visual-signature consent, administrator-verification procedure, memo template,
retention period and circumstances in which output generation is permitted. This visual mark is not PAdES or a
qualified signature. The next records-focused slice is S29’s broader auditor evidence pack/export; the next signing
extension is S31B certificate-backed signing or advanced reusable markup if policy requires it.
