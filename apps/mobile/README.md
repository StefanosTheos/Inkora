# Inkora mobile

The primary Inkora client uses Expo SDK 51, React Native, Expo Router, NativeWind, TanStack Query and Supabase. Screen components and root providers are implemented; route files are not a blanket set of empty placeholders.

## Current application

The Home route selects the seeker feed, artist business Home or studio dashboard according to the authenticated role. Other implemented areas include discovery, profiles, booking/availability, messaging, notifications, portfolio management, studio Team/applications/calendar/insights, and tattoo journeys. Coverage differs by role; see [the root feature matrix](../../README.md).

Mobile try-on composites an artist's existing flash design onto a chosen photo with an on-device renderer. It does not generate a tattoo through an AI model. The separate `ai/` package remains mock-only.

## Structure

```text
app/              Expo Router routes and layouts
src/features/     Role-specific screens, components and behavior
src/components/   Shared application components
src/lib/          Supabase, environment, images, analytics and query setup
src/providers/    Root provider composition
assets/           Bundled brand/application assets
```

For example, `app/(tabs)/index.tsx` delegates to `HomeScreen`, `ArtistHomeScreen` or `StudioDashboardScreen`. Use the route table in `@inkora/domain` where available and check actual route exports rather than treating old comments as feature-status evidence.

## Development

Follow [the complete setup guide](../../docs/SETUP.md) first. Create `apps/mobile/.env.local` from `.env.example` with your own `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never include a service-role key in a client environment.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @inkora/mobile android
# On macOS, with Xcode:
pnpm --filter @inkora/mobile ios
```

The native build includes modules such as MMKV and Skia. Expo Go is not a substitute for a compatible native runtime. Once that build is installed, use `pnpm dev:mobile` to start Metro; rebuild after changing native dependencies/configuration.

Android emulator Supabase access typically uses `http://10.0.2.2:54321`; a USB phone can use an ADB reverse tunnel, or use a reachable LAN address. See setup for details, auth redirects, push, storage and EAS ownership/configuration.

Open UX and production findings are maintained in [the roadmap](../../docs/ROADMAP.md), with prior audit details retained in the linked audit history.
