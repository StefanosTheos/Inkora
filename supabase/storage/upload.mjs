#!/usr/bin/env node
/**
 * Upload local images to a PUBLIC Supabase Storage bucket (upsert).
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node supabase/storage/upload.mjs [bucket] [dir]
 *
 * Defaults: bucket="styles", dir="supabase/storage/<bucket>".
 * The service-role key is required (Storage writes bypass RLS). NEVER commit it.
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const bucket = process.argv[2] ?? "styles";
const dir = process.argv[3] ?? join("supabase", "storage", bucket);

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const entries = await readdir(dir).catch(() => []);
const files = entries.filter((f) => MIME[extname(f).toLowerCase()]);
if (files.length === 0) {
  console.log(`No images found in ${dir} (looked for .jpg/.png/.webp).`);
  process.exit(0);
}

let ok = 0;
for (const f of files) {
  const body = await readFile(join(dir, f));
  const res = await fetch(`${URL.replace(/\/$/, "")}/storage/v1/object/${bucket}/${f}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": MIME[extname(f).toLowerCase()],
      "x-upsert": "true",
    },
    body,
  });
  console.log(`${res.ok ? "✓" : "✗"} ${bucket}/${f} (${res.status})`);
  if (res.ok) ok++;
}
console.log(`\nUploaded ${ok}/${files.length} to "${bucket}".`);
