# S20 — Confidentiality, need-to-know groups, watermarking and step-up access

Status: Implemented locally; pending feature commit.

## Practical outcome

Sensitive correspondence is no longer protected only by broad roles. Administrators can restrict a record to
named need-to-know groups; Secret records require both an eligible role and a fresh password confirmation; and
Confidential/Secret views, downloads and exports create a sensitive-access trail.

## Delivered controls

- Administrator-managed access groups, membership and record restriction by Flow reference.
- Central query policy across registry, exports, inboxes, acting desks, intake and dispatch.
- Central record policy across detail views, delegated mutations and attachment downloads.
- Fifteen-minute signed-session step-up after password re-confirmation for Secret records.
- Originators retain access; other users require membership in an assigned active group.
- System administration does not bypass need-to-know membership.
- Visible controlled-copy watermark on Confidential/Secret record views and printouts.
- User/date-stamped controlled filenames and response headers for sensitive downloads.
- Sensitive view, download and export events and an administrator access report.

## Explicit boundaries

- Download marking identifies controlled copies at delivery; it does not rewrite binary PDF/image content.
  Embedded per-page watermarking belongs in the future EDMS rendering contract.
- Password step-up is not enterprise MFA. OIDC/MFA and central revocation remain S23 gates.
- Redacted document variants require document rendering and approved content-governance rules.
- Access-group changes are locally administered pending authoritative identity/governance integration.
