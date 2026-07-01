# apps/mobile/assets — bundled mobile assets

Images/fonts **shipped inside the mobile app binary** (not fetched from Storage).

```
assets/
  icon.png            # app icon (1024×1024)        → referenced in app.config.ts
  splash.png          # splash screen               → app.config.ts
  adaptive-icon.png   # Android adaptive icon        → app.config.ts
  images/             # in-app static images (logos, illustrations, empty-state art)
  fonts/              # custom fonts (load via expo-font)
```

Use these for **app chrome and decorative UI** that is the same for every user.
Reference bundled images with `require("../../assets/images/foo.png")`.

❌ Do NOT put tattoo-style snapshots, artist portfolios, or any user/content imagery here —
those are hosted in Supabase Storage. See `supabase/storage/README.md` and `docs/ASSETS.md`.
