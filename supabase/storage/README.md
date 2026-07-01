# supabase/storage — staging for hosted images

Curated/brand images that the product ships (not user uploads) are **staged here** and
**uploaded to Supabase Storage buckets**. They are served by URL, not bundled in the apps.

| Folder | Bucket | Visibility | What goes here |
|---|---|---|---|
| `styles/` | `styles` | public | Tattoo-style snapshots for the onboarding questionnaire (`<slug>.jpg`) |
| _(future)_ `seed-ideas/` | `ideas` | public | Curated inspiration images for the seed feed |

**User-generated images are NOT staged here** — avatars, portfolio images, chat
attachments, journey photos, AI previews, and saved designs are uploaded at runtime by the
apps via signed URLs into their buckets (`avatars`, `portfolio`, `ideas`, `chat-attachments`,
`journey`, `ai-previews`, `saved-designs`). See the storage policies in
`supabase/migrations/20260629121600_storage.sql`.

## Upload helper
`upload.mjs` uploads every image in a folder to a bucket (upsert):
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/storage/upload.mjs <bucket> [dir]
# default: bucket=styles, dir=supabase/storage/styles
```
