# web/src/features

Mirrors the mobile `features/` names (`feed`, `discovery`, `messaging`, `booking`,
`rewards`, `onboarding`, `dashboards`, `create-idea`). Logic comes from shared hooks
(`@inkora/data-access`); only the rendered components differ (compose `@inkora/ui-web`).

Pages in `app/` stay thin and import a feature's exported screen/section.

**TODO:** create feature folders as pages are built.
