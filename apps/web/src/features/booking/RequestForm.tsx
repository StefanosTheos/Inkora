"use client";
import { createBookingRequest, useArtistProfile, useStudioProfile } from "@inkora/data-access";
import type { BookingRequestInput } from "@inkora/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getSupabaseBrowser } from "../../lib/supabase-browser";

const PLACEMENTS = ["Forearm", "Upper arm", "Leg", "Back", "Chest", "Ribs", "Hand", "Neck", "Other"];
const SIZES = ["XS (< 5cm)", "S (5–10cm)", "M (10–20cm)", "L (20cm+)"];

export function RequestForm({ artistId, studioSlug }: { artistId?: string; studioSlug?: string }) {
  const client = getSupabaseBrowser();
  const router = useRouter();
  const isStudio = !!studioSlug;
  const studio = useStudioProfile(client, studioSlug ?? "");
  const [chosenArtist, setChosenArtist] = useState<string>(""); // "" = studio decides
  const effectiveArtistId = isStudio ? (chosenArtist || studio.data?.ownerId || "") : (artistId ?? "");
  const artistProfile = useArtistProfile(client, isStudio ? "" : (artistId ?? ""));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placement, setPlacement] = useState("");
  const [size, setSize] = useState("");
  const [isColor, setIsColor] = useState<boolean | null>(null);
  const [preferredDate, setPreferredDate] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [busy, setBusy] = useState(false);

  const heading = isStudio ? (studio.data ? `Request booking · ${studio.data.name}` : "Request booking") : (artistProfile.data ? `Request booking · ${artistProfile.data.displayName}` : "Request booking");

  async function submit() {
    if (!title.trim()) { alert("Describe what you want to get."); return; }
    if (!effectiveArtistId) { alert("Pick an artist or let the studio choose."); return; }
    setBusy(true);
    try {
      const input: BookingRequestInput = {
        artistId: effectiveArtistId as BookingRequestInput["artistId"],
        studioId: (isStudio ? studio.data?.id : undefined) as BookingRequestInput["studioId"],
        title: title.trim(),
        description: description.trim() || null,
        placement: placement || null,
        approxSize: size || null,
        isColor,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        preferredDate: preferredDate || null,
      };
      const id = await createBookingRequest(client, input);
      router.replace(`/booking/${id}`);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold">{heading}</h1>
      <div className="mt-4 space-y-3">
        {isStudio && (
          <Field label="Preferred artist">
            <select value={chosenArtist} onChange={(e) => setChosenArtist(e.target.value)} className="w-full rounded-lg border px-3 py-2">
              <option value="">Let the studio choose</option>
              {(studio.data?.roster ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.displayName}{r.styles.length ? ` — ${r.styles.slice(0, 2).join(", ")}` : ""}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="What do you want to get?">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fine-line wildflower on forearm" className="w-full rounded-lg border px-3 py-2" />
        </Field>
        <Field label="Describe your idea">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border px-3 py-2" rows={3} />
        </Field>
        <Field label="Placement">
          <select value={placement} onChange={(e) => setPlacement(e.target.value)} className="w-full rounded-lg border px-3 py-2">
            <option value="">Any</option>
            {PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Approx. size">
          <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-lg border px-3 py-2">
            <option value="">Not sure</option>
            {SIZES.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
          </select>
        </Field>
        <Field label="Color">
          <div className="flex gap-2">
            {[["Black & grey", false], ["Color", true]].map(([label, val]) => (
              <button key={String(val)} onClick={() => setIsColor(val as boolean)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${isColor === val ? "bg-[#E5484D] text-white" : "bg-zinc-100"}`}>{label as string}</button>
            ))}
          </div>
        </Field>
        <Field label="Preferred date (optional)">
          <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        </Field>
        <div className="flex gap-2">
          <input placeholder="Budget min €" inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          <input placeholder="Budget max €" inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        </div>
        <button disabled={busy} className="w-full rounded-lg bg-[#E5484D] px-4 py-3 font-semibold text-white disabled:opacity-40" onClick={submit}>{busy ? "Sending…" : "Send request"}</button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
