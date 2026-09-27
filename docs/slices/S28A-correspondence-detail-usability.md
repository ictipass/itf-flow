# S28A — Correspondence detail readability and workflow guidance

Status: **Implemented locally**

## Practical outcome

The correspondence detail page keeps its compact movement timeline visible while placing the more detailed passage,
custody and elapsed-time visualization behind an accessible disclosure that is collapsed by default. Glass-mode
journey surfaces now retain readable contrast, attachment security states explain why a document is unavailable, and
physical-file controls are explicitly optional rather than appearing to be a required digital workflow step.

## Delivered scope

- Native, keyboard-accessible passage disclosure with a rotating chevron and current status visible while closed.
- Glass-interface contrast corrections for journey summaries, minutes, branches, recipients and attachment panels.
- Plain-language attachment availability guidance for quarantined, processing, failed, rejected and clean files.
- Optional, collapsible Records desk panel that opens automatically when a physical tracking record already exists.
- Clearer **Create physical tracking record** wording and separation from digital routing.
- An in-application and Markdown end-to-end workflow from composition through acknowledgement, movement, resolution,
  outgoing delivery/closure and retained evidence.

## Boundaries

- Collapsing the passage changes presentation only; no audit event or workflow state is hidden or deleted.
- Quarantined documents remain unavailable until the production malware-scanner adapter and worker complete.
- In-document annotation and visual signing remain planned S31/S30 work. This slice does not modify document bytes.
