# S31B — Certificate-backed PDF signing policy gate

Status: **Blocked by management/legal/PKI policy; not represented as implemented**

ITF Flow currently supplies authenticated application assertions and visual signatures with identity, MFA policy,
delegation, timestamp, revision and hash evidence. These are not PAdES certificates or qualified signatures.

Implementation must not begin until ITF approves:

1. legal effect and document classes requiring certificate signatures;
2. certificate authority/trust chain and signer identity proofing;
3. individual versus organizational seals and delegated signing authority;
4. private-key custody, HSM/remote-signing service and recovery/revocation procedure;
5. trusted timestamp authority, long-term validation profile and validation lifetime;
6. signed-PDF preservation rules, archival validation data and EDMS verification contract; and
7. incident response, audit, subscription/procurement and data-residency ownership.

After approval, S31B should implement provider abstraction, PAdES profile selection, certificate/revocation validation,
trusted timestamps, visible signature appearance, fail-closed provider behavior and independent conformance tests.
