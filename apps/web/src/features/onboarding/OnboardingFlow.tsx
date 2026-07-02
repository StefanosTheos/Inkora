"use client";
import {
  computePreferences, publicStorageUrl, topStyleSlugs, updateProfileLocation, useAuth,
  useFinishOnboarding, useRecommendedArtists, useStyleDeck,
} from "@inkora/data-access";
import { type OnboardingReaction, REACTION_WEIGHTS, type StyleCard } from "@inkora/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { env } from "../../lib/env";
import { getSupabaseBrowser } from "../../lib/supabase-browser";

const NEXT: Record<OnboardingReaction, OnboardingReaction> = { skip: "like", like: "love", love: "skip" };
const BADGE: Record<OnboardingReaction, string> = { skip: "", like: "♥ Like", love: "★ Love" };

export function OnboardingFlow() {
  const client = getSupabaseBrowser();
  const router = useRouter();
  const { refresh } = useAuth();
  const deck = useStyleDeck(client);
  const finish = useFinishOnboarding(client);

  const [reactions, setReactions] = useState<Record<string, OnboardingReaction>>({});
  const [phase, setPhase] = useState<"select" | "results">("select");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);

  const styles = deck.data ?? [];
  const weights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const [id, r] of Object.entries(reactions)) w[id] = REACTION_WEIGHTS[r];
    return w;
  }, [reactions]);
  const prefs = useMemo(() => computePreferences(weights, styles), [weights, styles]);
  const slugs = useMemo(() => topStyleSlugs(prefs, 3), [prefs]);
  const recs = useRecommendedArtists(client, slugs, phase === "results");

  const cycle = (id: string) =>
    setReactions((prev) => ({ ...prev, [id]: NEXT[prev[id] ?? "skip"] }));

  async function onFinish() {
    setSaving(true);
    if (city.trim()) await updateProfileLocation(client, city, country); // geocodes "city, country" → lat/lng
    const res = await finish.mutateAsync(weights);
    if (!res.ok) {
      setSaving(false);
      alert(res.error.message);
      return;
    }
    await refresh();
    router.replace("/");
  }

  if (deck.isLoading) return <p className="p-8 text-center text-zinc-500">Loading styles…</p>;

  if (phase === "results") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Your tattoo taste</h1>
        {prefs.length === 0 ? (
          <p className="text-zinc-500">Give a few styles a Like or Love to get recommendations.</p>
        ) : (
          prefs.map((p) => (
            <div key={p.styleId} className="mb-2 flex items-center gap-3">
              <span className="w-28 text-sm font-medium">{p.name}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded bg-zinc-100">
                <span className="block h-full rounded bg-[#E5484D]" style={{ width: `${p.percentage}%` }} />
              </span>
              <span className="w-10 text-right text-sm font-bold">{p.percentage}%</span>
            </div>
          ))
        )}

        <h2 className="mb-3 mt-8 text-xl font-bold">Artists for you</h2>
        {recs.isLoading ? (
          <p className="text-zinc-500">Finding matches…</p>
        ) : (recs.data ?? []).length === 0 ? (
          <p className="text-zinc-500">No matches yet — explore the feed to discover more.</p>
        ) : (
          (recs.data ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1F1B2E] font-bold text-white">
                {a.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{a.displayName}</p>
                <p className="truncate text-sm text-zinc-500">{a.headline ?? a.styles.join(", ")}</p>
              </div>
              <span className="font-bold">★ {a.ratingAvg.toFixed(1)}</span>
            </div>
          ))
        )}

        <div className="mt-8">
          <label className="mb-1 block text-sm font-semibold">Where are you based?</label>
          <div className="flex gap-2">
            <input
              className="w-1/2 rounded border p-3"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <input
              className="w-1/2 rounded border p-3"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button className="rounded border px-4 py-3 font-medium" onClick={() => setPhase("select")}>Back</button>
          <button className="flex-1 rounded bg-[#E5484D] py-3 font-semibold text-white" disabled={saving} onClick={onFinish}>
            {saving ? "Saving…" : "Start exploring"}
          </button>
        </div>
      </main>
    );
  }

  const selectedCount = Object.values(reactions).filter((r) => r !== "skip").length;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">What catches your eye?</h1>
      <p className="mb-5 text-zinc-500">Tap a style to cycle Like → Love. Pick as many as you like.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {styles.map((card) => (
          <StyleTile key={card.id} card={card} reaction={reactions[card.id] ?? "skip"} onClick={() => cycle(card.id)} />
        ))}
      </div>
      <button
        className="mt-6 w-full rounded bg-[#E5484D] py-3 font-semibold text-white disabled:opacity-40"
        disabled={selectedCount === 0}
        onClick={() => setPhase("results")}
      >
        See my results ({selectedCount})
      </button>
    </main>
  );
}

function StyleTile({ card, reaction, onClick }: { card: StyleCard; reaction: OnboardingReaction; onClick: () => void }) {
  const uri = card.imagePath ? publicStorageUrl(env.SUPABASE_URL, card.imagePath) : undefined;
  const ring = reaction === "love" ? "ring-2 ring-[#E5484D]" : reaction === "like" ? "ring-2 ring-pink-300" : "";
  return (
    <button onClick={onClick} className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-[#1F1B2E] text-left ${ring}`}>
      {uri ? <img src={uri} alt={card.name} className="absolute inset-0 h-full w-full object-cover" /> : null}
      <span className="absolute inset-x-0 bottom-0 bg-black/40 p-2 text-sm font-bold text-white">{card.name}</span>
      {reaction !== "skip" && (
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold">{BADGE[reaction]}</span>
      )}
    </button>
  );
}
