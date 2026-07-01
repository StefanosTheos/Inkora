# domain/schemas

zod validation schemas — the **single** validation source shared by client (UX) and
server (truth). Types are inferred from these via `z.infer`, never hand-written, so
the form, the API boundary, and the DB contract cannot drift.

**TODO (do not implement business logic yet):** define one schema file per entity:
`auth.schema.ts`, `profile.schema.ts`, `booking-request.schema.ts`, `message.schema.ts`,
`ai-preview.schema.ts`, … Each exports the zod schema + the inferred input type.

Rules:
- enums in schemas must reference `../enums` values (keep in sync with Postgres).
- refinements mirror DB constraints (e.g. `budgetMax >= budgetMin`).
