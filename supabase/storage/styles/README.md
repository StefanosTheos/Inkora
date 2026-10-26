# Style snapshot images → `styles` bucket

**👉 Put the tattoo-style images for the onboarding questionnaire in THIS folder, then upload them.**

These are NOT bundled into the apps. They're served from the public Supabase Storage
`styles` bucket and referenced by `tattoo_styles.image_path` (e.g. `styles/fineline.jpg`).

## Required filenames (must match the style `slug` + `.jpg`)

```
fineline.jpg
blackwork.jpg
traditional.jpg
neo_traditional.jpg
realism.jpg
watercolor.jpg
japanese.jpg
geometric.jpg
dotwork.jpg
lettering.jpg
```

- Filename must equal the style **slug** so it matches the seeded `image_path`.
- Default extension is **.jpg**. If you use `.png`/`.webp` instead, update the column to match:
  `update tattoo_styles set image_path = 'styles/' || slug || '.png';`
- Recommended: portrait, ~1200×1600, optimized (< 300 KB each).

## Upload them

From the repo root, with your service-role key set:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
node supabase/storage/upload.mjs styles
```

(Get the key from Supabase → Project Settings → API → `service_role`. Never commit it.)

Until images are uploaded, the questionnaire cards render a styled colored fallback with
the style name — so the flow works regardless.
