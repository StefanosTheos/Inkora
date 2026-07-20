"use client";
// AI Preview — PLACEHOLDER (web, secondary). There is no server-side generation
// and no in-browser compositing yet, so this screen is read-only: it explains the
// feature, shows example styles, and lists any try-ons the user saved on mobile.
import { MOCK_PREVIEW_EXAMPLES } from "@inkora/ai";
import { publicStorageUrl, useAiPreviews } from "@inkora/data-access";
import { AI_PREVIEW_DISCLAIMER, AI_PREVIEW_STATUS_LABEL } from "@inkora/domain";

import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (p: string) => publicStorageUrl(env.SUPABASE_URL, p);

export function AiPreviewView() {
  const client = getSupabaseBrowser();
  const previews = useAiPreviews(client);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">AI Preview</h1>
      <p className="text-zinc-600">See how a design could look on your skin.</p>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">✨ {AI_PREVIEW_DISCLAIMER}</div>

      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="font-bold">Try a design on</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Tattoo try-on lives in the Inkora mobile app — pick a flash, drop it onto a photo,
          and save the mockup. Your saved try-ons show up here.
        </p>
      </section>

      {(previews.data ?? []).length > 0 && (
        <>
          <h2 className="mt-8 mb-2 text-lg font-bold">Your previews</h2>
          <ul className="space-y-2">
            {(previews.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl border p-3">
                <span className="font-semibold">{p.placement ?? p.prompt ?? "Preview"}</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{AI_PREVIEW_STATUS_LABEL[p.status]}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 mb-2 text-lg font-bold">Example styles</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MOCK_PREVIEW_EXAMPLES.map((ex) => (
          <div key={ex.id}>
            <img src={img(ex.imagePath)} alt={ex.label} className="aspect-square w-full rounded-xl object-cover" />
            <p className="mt-1 text-sm font-semibold">{ex.label}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
