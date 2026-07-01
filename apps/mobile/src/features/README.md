# mobile/src/features

Screen LOGIC, organized by feature (mirrors web's `features/`). Each feature folder:

```
<feature>/
  components/   # presentational pieces (compose @inkora/ui-native)
  hooks/        # screen/headless hooks (wrap @inkora/data-access hooks)
  index.ts      # public surface — route files import from here
```

Features: `feed`, `discovery`, `messaging`, `booking`, `rewards`, `onboarding`,
`profile`, `create-idea` (AI placeholder), `dashboards`.

Route files in `app/` stay thin — they import a feature's screen and render it.
Cross-feature imports go through `index.ts`, never deep paths.

**TODO:** create feature folders as screens are built.
