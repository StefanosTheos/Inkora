"use client";
// AI Preview — PLACEHOLDER (web, secondary). Persists requests only; no generation.
import { MOCK_PREVIEW_EXAMPLES } from "@inkora/ai";
import { aiKeys, createAiPreview, publicStorageUrl, uploadPreviewSource, useAiPreviews } from "@inkora/data-access";
import { AI_PLACEMENTS, AI_PREVIEW_DISCLAIMER, AI_PREVIEW_STATUS_LABEL, type AiPreviewInput } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const img = (p: string) => publicStorageUrl(env.SUPABASE_URL, p);

export function AiPreviewView() {
  const client = getSupabaseBrowser();
  const qc = useQueryClient();
  const previews = useAiPreviews(client);
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [placement, setPlacement] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!file) { alert("Add a photo of where you want the tattoo."); return; }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const ext = file.type.includes("png") ? "png" : "jpg";
      const sourceImagePath = await uploadPreviewSource(client, buf, file.type || "image/jpeg", ext);
      // TODO(ai): enqueue generation via the AiPreviewService boundary. No model here.
      const input: AiPreviewInput = { sourceImagePath, prompt: prompt.trim() || undefined, placement: placement || undefined };
      await createAiPreview(client, input);
      await qc.invalidateQueries({ queryKey: aiKeys.list });
      setFile(null); setPrompt(""); setPlacement("");
      alert("Preview requested — AI rendering is coming soon.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">AI Preview</h1>
      <p className="text-zinc-600">See how a design could look on your skin.</p>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">✨ {AI_PREVIEW_DISCLAIMER}</div>

      <section className="mt-6 space-y-3 rounded-2xl border p-4">
        <h2 className="font-bold">New preview</h2>
        <label className="block text-sm font-semibold">Your photo
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
        </label>
        <label className="block text-sm font-semibold">Describe the tattoo
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border px-3 py-2" placeholder="e.g. a small fine-line wildflower" />
        </label>
        <label className="block text-sm font-semibold">Placement
          <select value={placement} onChange={(e) => setPlacement(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2">
            <option value="">Any</option>
            {AI_PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button disabled={busy || !file} onClick={generate} className="rounded-lg bg-[#E5484D] px-4 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Requesting…" : "✨ Generate preview"}</button>
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
