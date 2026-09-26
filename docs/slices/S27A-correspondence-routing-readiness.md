# S27A — Correspondence origination and routing readiness

## Business outcome

Staff can distinguish document type, workflow category and routing purpose before submitting correspondence. Category
selection is limited to the selected document type, concurrence is explained in operational language, and sequential
routing guidance prevents users from accidentally creating parallel responsibilities. Directory search now explains
the difference between a valid empty action result and an actual search failure.

## Delivered

- Role-scoped explanation that external Incoming Letters are registered by authorized Secretariat/Records staff.
- Dynamic Workflow Category filtering by Document Type.
- Plain-language help for Action, Review, Concurrence and Formal Approval.
- A sequential A → B → C → Z example: only the next accountable holder is the action recipient; an information-only
  recipient is copied.
- Explicit action-recipient reporting-line guidance and organization-wide copy-recipient guidance.
- Visible directory-search error state instead of silently displaying an empty result.
- A pure server query-scope rule and regression tests proving that copy search is organization-wide while action
  search remains hierarchy-controlled.

## Important boundary

This slice does not broaden action-routing authority. Workspace must contain the approved Flow role and supervisor
relationship, and the directory must be synchronized. Existing-user reporting-line correction is delivered in paired
Workspace slice W44. Department Secretariat context switching remains a later slice.

## Acceptance

- A user sees only categories compatible with the selected document type.
- An ordinary user is told why Incoming Letter is unavailable.
- Concurrence is not presented as final approval.
- Copy lookup does not inherit the action-recipient hierarchy filter.
- Failed directory requests are distinguishable from legitimate zero-result searches.
