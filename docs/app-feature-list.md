# ITF Flow feature and use-case catalogue

| Feature | Explicit practical use case | Primary users | Production boundary |
|---|---|---|---|
| Staff correspondence creation and private drafts | An officer prepares a memo incrementally before it becomes an official record. | All staff | Production identity and retention policies apply. |
| Secretariat shared intake and atomic claim | One Secretary takes custody of an incoming item without two desks registering it simultaneously. | DG Secretaries, Records | Mail automation and document services require production configuration. |
| Registration and stable references | A validated incoming letter receives a searchable ITF reference and enters DG workflow. | Secretariat, Records | Reference ownership and retention require governance approval. |
| Hierarchical routing and minutes | An officer sends to the Unit Head and each subsequent manager records a reason/instruction. | Staff leadership chain | Workspace reporting lines must be authoritative. |
| Multi-recipient action/copy | One recipient owns treatment while others receive auditable visibility. | All staff | Authorization remains server-side. |
| Review, concurrence and approval | A Director requests a formal, separately recorded decision instead of treating ordinary routing as approval. | Directors, DG, authorized delegates | Current HMAC assertion is not a PKI-qualified signature. |
| Immutable revisions | Returned correspondence is corrected as a new version without rewriting the earlier official record. | Originators, reviewers | Retention/legal policy must approve lifecycle. |
| Dispatch registry | Secretariat records channel, recipient, outgoing reference and delivery state for approved correspondence. | Secretariat, Records | SMTP acceptance is not recipient delivery confirmation. |
| Notifications and durable email outbox | Assignments and decisions create in-app alerts and retryable email work without delaying the business transaction. | All staff, operators | Scheduler, mail service and alerting must be configured. |
| Reminders, escalations and digests | Due work prompts the owner, escalates through reporting lines and appears in executive summaries. | Assignees, supervisors, DG | Worker schedule and policy ownership required. |
| Secretariat physical-file controls | Records staff capture scan desk/page count, current physical location, duplicate decision and QR label. | Secretariat, Records | Metadata is not malware scanning or EDMS custody. |
| Search and registers | Authorized users locate correspondence by content/reference/owner and export correspondence or movement evidence. | Staff, audit/records users | OCR content requires S24B; exports remain classification-filtered. |
| Delegation and acting office | An acting officer treats a substantive desk’s inbox while both identities remain visible. | Leadership, administrators | Workspace/HR should provide authoritative appointment dates. |
| Confidentiality and need-to-know | A confidential matter is discoverable only by workflow-authorized group members. | Authorized staff, administrators | Governance and independent authorization tests remain gates. |
| Secret step-up and controlled copies | An eligible viewer re-authenticates before viewing Secret material and access is logged/watermarked. | Privileged roles | Enterprise MFA and EDMS-rendered watermark/redaction remain production dependencies. |
| Authenticated stakeholder portal | An external organization submits Public correspondence, tracks coarse status and answers clarification without seeing internal minutes. | External organizations, staff handlers | Anti-abuse/privacy operations and attachment integration require production approval. |
| Workspace identity interoperability | An entitled staff member launches Flow with enterprise MFA context and can be centrally logged out or deactivated. | Staff, ICT | Real IdP registration, managed keys and end-to-end tests required. |
| Secure document foundation | Uploads are quarantined, hashed, magic-byte checked and released only after a configured scanner reports clean. | All document users | Real EDMS/scanner/OCR adapters are S24B and still outstanding. |
| Workflow templates, SLAs and simulation | An administrator previews and activates governed routing/approval rules for future records without mutating existing cases. | System administrators, process owners | Business-rule ownership and approved SLAs required. |
| Configurable staff experiences | An administrator previews and selects Classic, Modern, Soft UI or Glass without changing permissions/workflow data. | System administrators, all staff | Accessibility testing must cover the selected production mode. |
| Assurance dashboard and health endpoints | ICT separates process liveness/readiness from formal production approval and records external evidence. | System administrators, operations | Tooling does not replace penetration tests, recovery drills or sign-off. |

For role-by-role operation, see `docs/user-guide.md`. For delivered commits and remaining dependencies, see `docs/implementation-slice-register.md`.
