# @inkora/mobile — ⭐ PRIMARY

Inkora's primary experience. Expo + **Expo Router** (file-based), NativeWind styling, FlashList feed, MMKV-backed offline cache.

## Structure

```
app/                 # Expo Router — ROUTES ONLY (thin; delegate to src/features)
  _layout.tsx        # root: providers + auth/onboarding gate
  (auth)/            # welcome, sign-in, sign-up, onboarding, auth callback
  (tabs)/            # 5-tab shell: Home · Discover · Create · Chats · Profile
  artist/[handle]    # pushed onto current tab's stack
  studio/[handle]
  (modals)/          # filters, booking request, image viewer
  (artist-dashboard) # role mode
  (studio-dashboard) # role mode
src/
  features/          # screen logic (components + hooks) per feature
  components/         # generic app components (compose @inkora/ui-native)
  lib/                # supabase client (SecureStore), query client, env, analytics
  providers/          # app-root provider composition
```

Navigation paths come from the SHARED route table (`@inkora/domain/navigation`) — never hard-coded.

**TODO:** implement screens/providers. Route files are placeholders (need a default-export component).
