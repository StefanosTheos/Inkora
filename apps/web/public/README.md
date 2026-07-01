# apps/web/public — static web assets

Files here are served at the site root by Next.js (e.g. `public/logo.svg` → `/logo.svg`).

```
public/
  favicon.ico
  og-default.png      # default OpenGraph/social share image
  images/             # static marketing/UI images
```

Use for **site chrome, favicons, OG images, and marketing visuals**. Reference with a
root-absolute path: `<img src="/images/foo.png" />` or `next/image`.

❌ Do NOT put tattoo-style snapshots or user/content imagery here — those live in Supabase
Storage. See `supabase/storage/README.md` and `docs/ASSETS.md`.
