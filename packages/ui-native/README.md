# @inkora/ui-native — 📱 MOBILE ONLY

**PLATFORM: React Native only.** Do NOT import from `apps/web`. Built on RN primitives + NativeWind, styled from `@inkora/design-tokens`.

Mirrors `@inkora/ui-web` in *intent* (same component names, same props where sensible) but is a separate implementation — Radix/shadcn cannot render in RN, and that's by design.

Components (placeholders): `Button`, `Text`, `Avatar`, `Card`, `Sheet`, `Input`, `Chip`, `Skeleton`, `EmptyState`, `ImageView`, `TabBar`, `Haptics`.

Behavior comes from shared hooks (`@inkora/data-access` + feature hooks); these are presentational.

**TODO:** implement components. No business logic here.
