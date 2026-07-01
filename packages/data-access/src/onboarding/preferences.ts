import type {
  ArtistId, RecommendedArtist, Result, StyleCard, StyleId, StylePreference,
} from "@inkora/domain";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

/** Fetch the active styles for the questionnaire deck (image snapshot + label). */
export async function fetchStyleCards(client: InkoraClient): Promise<StyleCard[]> {
  const { data, error } = await client
    .from("tattoo_styles")
    .select("id, slug, name, image_path")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as StyleId,
    slug: r.slug,
    name: r.name,
    imagePath: r.image_path,
  }));
}

/** Turn accumulated reaction weights into ranked preferences with percentages. */
export function computePreferences(
  weights: Record<string, number>,
  styles: StyleCard[],
): StylePreference[] {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0) || 1;
  return styles
    .map((s) => {
      const weight = weights[s.id] ?? 0;
      return {
        styleId: s.id,
        slug: s.slug,
        name: s.name,
        weight,
        percentage: Math.round((weight / total) * 100),
      };
    })
    .filter((p) => p.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

/** Top-N style slugs by weight (used to query recommendations). */
export function topStyleSlugs(prefs: StylePreference[], n = 3): string[] {
  return prefs.slice(0, n).map((p) => p.slug);
}

/** Recommend artists overlapping the user's top styles (via the recommended_artists RPC). */
export async function getRecommendedArtists(
  client: InkoraClient,
  styleSlugs: string[],
  limit = 10,
): Promise<RecommendedArtist[]> {
  const { data, error } = await client.rpc("recommended_artists", {
    p_style_slugs: styleSlugs,
    p_limit: limit,
  });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ArtistId,
    displayName: r.display_name,
    avatarPath: r.avatar_path,
    headline: r.headline,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    matchCount: Number(r.match_count),
    styles: r.styles ?? [],
  }));
}

/**
 * Persist the questionnaire result and complete onboarding in one go:
 * upsert positive-weight style preferences, then stamp profiles.onboarded_at.
 * Call `auth.refresh()` afterward so the gate routes the user onward.
 */
export async function finishOnboarding(
  client: InkoraClient,
  weights: Record<string, number>,
): Promise<Result<void>> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false, error: { code: "unauthenticated", message: "Not signed in", retriable: false } };

  const rows = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .map(([style_id, weight]) => ({ profile_id: uid, style_id, weight }));

  if (rows.length > 0) {
    const { error } = await client
      .from("user_style_preferences")
      .upsert(rows, { onConflict: "profile_id,style_id" });
    if (error) return { ok: false, error: toAppError(error) };
  }

  const { error: profErr } = await client
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", uid);
  if (profErr) return { ok: false, error: toAppError(profErr) };

  return { ok: true, value: undefined };
}
