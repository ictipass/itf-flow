# S30 — Governed reusable signature profiles and ITF memo output

Status: **Implemented; migrations, policy and staging acceptance pending**

Implementation commits: `ef99432`, `5f649a6`, `2137b8d`

## Outcome

Every active staff user can submit a versioned PNG image of their own signature from **Signature profile**. Because
the submission is made in the staff member's authenticated session and includes an ownership/use attestation, the
latest version becomes active immediately. System administrators audit the register and may revoke a signature; they
do not process an approval queue. Replacements, supersession and revocation remain visible history.

Once an internal memo reaches `RESOLVED` or `CLOSED`, an authorized participant or records role can generate a
versioned PDF. The first page follows the supplied ITF memo template. It contains the originator's department, name,
reference, initial action recipient, memo date, subject, body, active visual signature, printed name and position.
Controlled lifecycle evidence follows as appendix pages with routing/minute history, decisions and the included-
document hash manifest.

At initial submission, Flow also creates an annotatable **working memo packet** in the configured document store.
It places the ITF memo first and appends every security-cleared PDF, JPEG or PNG attachment. Action recipients minute
and sign that packet through the existing in-app annotation workspace. The original and each annotated version remain
immutable. Existing memos can create their packet from the correspondence page.

Memo composition uses a constrained rich-text editor. Server-side sanitization permits paragraphs, headings,
bold/italic/underline, lists and quotations and removes scripts, attributes and unsupported markup. The same
normalized content drives both the correspondence page and styled PDF rendering.

## Signature governance

- PNG only, maximum 1 MB, bounded dimensions and server-side file-signature/header/decoder validation.
- A mandatory ownership/use attestation is stored with every submission.
- An authenticated self-submission becomes active immediately. A replacement supersedes the earlier active version
  for future outputs without deleting it.
- Administrators can audit all versions and revoke an active profile with a reason of at least 10 characters.
- Revocation stops future output generation with that profile. Historical outputs retain the exact profile version
  and signature hash used when they were generated.
- Profile image routes are restricted to the owner and system administrators.

`SignatureProfileStatus.APPROVED` remains the persisted enum value for an active signature for migration
compatibility. Staff-facing pages label that state **Active**; it no longer means an administrator approved it.

## ITF memo template mapping

| Template field | ITF Flow source |
| --- | --- |
| Organization title | Fixed `INDUSTRIAL TRAINING FUND` |
| Department | Originator's synchronized department, falling back to office |
| FROM | Originator's synchronized full name |
| REF | Sender reference, falling back to the ITF Flow reference |
| TO | Initial action recipient(s) captured when the memo was first routed |
| DATE | Date on document, falling back to the received/created date |
| Subject and body | Current correspondence revision |
| Signature block | Active signature PNG, originator name and synchronized position |

The lifecycle appendix is intentionally separate from the template page so the business memo remains familiar while
the official output still answers an auditor's question about route, decisions, document versions and hashes.

## Memo-output controls

- Output is limited to resolved/closed `INTERNAL_MEMO` correspondence.
- Server-side access repeats participant/broad-role, need-to-know and Secret step-up checks.
- Generation fails safely when the originator lacks an active signature profile.
- The renderer uses the latest correspondence revision and produces a new immutable output version; it does not
  replace correspondence attachments or mutate the revision.
- The database retains output storage metadata, SHA-256, revision, originator, generator, active profile and template
  version. A signed canonical payload binds those fields together.
- Download rechecks both the HMAC-backed canonical record and stored PDF hash. Sensitive downloads use the existing
  access log and controlled filename behavior.
- The output is stored by the configured document provider and therefore works with local development storage or
  private Vercel Blob without another provider or environment variable.
- The renderer uses a small bundled ITF logo asset and never reads `/var/task/public` or writes a generated file to
  the serverless filesystem. Working packets and final outputs are stored through the configured provider.
- Security-cleared PDF/JPEG/PNG attachments are appended between the memo and lifecycle appendix. With
  `DOCUMENT_CONVERTER_PROVIDER=GOTENBERG`, DOCX/XLSX are converted through the LibreOffice API and appended as PDF
  pages. Successfully included sources are hidden from the separate package list; pending/unconverted sources remain
  visible. Disabling or losing the converter never makes the original source disappear.

## Data and deployment

Migration `20260928120000_add_signature_profiles_and_memo_outputs` adds `SignatureProfile`, `MemoOutput`,
`SignatureProfileStatus`, their relations and the `MEMO_OUTPUT_GENERATED` event.

Migration `20260928140000_auto_approve_signature_profiles` changes new submissions to the active persisted status,
activates the latest existing pending version for each user, and supersedes older pending/active versions safely.

Migration `20260928170000_add_working_memo_packets` identifies the current derived memo packet without confusing it
with user-supplied source attachments or correspondence revision manifests.

Signature bytes are small governed profile data in PostgreSQL; generated PDFs use the configured document store.
Existing `pdf-lib` rendering and application HMAC controls are used. DOCX/XLSX conversion introduces an optional
Gotenberg deployment or managed-service cost; keep `DOCUMENT_CONVERTER_PROVIDER=DISABLED` until an approved private
endpoint is available. If ITF later requires a signature verifiable outside Flow, a certificate authority, managed
signing key/HSM and trusted timestamp service remain separate dependencies.

## Verification

- Assurance tests cover bounded PNG validation, PNG decoding and parseable multi-page lifecycle output.
- `npm run verify` covers Prisma validation, generated route/type checking, ESLint and the optimized route build.

## Staging acceptance

1. Apply the S30 migrations and deploy the implementation commits.
2. Submit a transparent PNG from a normal staff account; confirm it is immediately **Active** and usable.
3. Submit a replacement; confirm the new version activates and the earlier version becomes superseded.
4. Resolve an internal memo raised by that user and generate the output from an authorized participant.
5. Compare the first page against the supplied ITF memo template and verify every mapped field and signature block.
6. Inspect the appendix movement/minutes, decisions and document hashes against the live record.
7. Generate a second output and verify both versions remain downloadable with successful integrity indicators.
8. Revoke the current signature, confirm future generation is blocked and historical output remains valid.
9. Repeat with Confidential and Secret test records to validate need-to-know and step-up controls.
10. With the converter disabled, verify DOCX/XLSX remain separately accessible. Then configure an approved Gotenberg
    endpoint, submit one DOCX and one XLSX, and confirm each rendition appears in the packet as PDF while its included
    source is not shown twice.

## Policy boundary and next slice

Management/Legal must approve visual-signature consent, revocation procedure, memo template, retention period and the
circumstances in which output generation is permitted. This visual mark is not PAdES or a qualified signature. The
next records-focused slice is S29's broader auditor evidence pack/export; the next signing extension is S31B
certificate-backed signing or advanced reusable markup if policy requires it.
