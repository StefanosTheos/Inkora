import type {
  ArtistId, HomeArtist, IdeaCard, IdeaId, NearbyStudio, Page, Promotion, StudioId,
} from "@inkora/domain";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

// ---- row shapes for embedded selects (cast to avoid PostgREST inference friction) ----
interface EmbeddedArtistRow {
  id: string;
  headline: string | null;
  rating_avg: number;
  rating_count: number;
  profiles: { display_name: string; avatar_path: string | null } | null;
  artist_styles: { tattoo_styles: { slug: string } | null }[] | null;
}
interface IdeaRow {
  id: string;
  title: string | null;
  image_path: string;
  width: number | null;
  height: number | null;
  save_count: number;
  source_artist_id: string | null;
  created_at: string;
  idea_styles: { tattoo_styles: { slug: string } | null }[] | null;
}

const ARTIST_SELECT =
  "id, headline, rating_avg, rating_count, profiles!inner(display_name, avatar_path), artist_styles(tattoo_styles(slug))";

function toHomeArtist(r: EmbeddedArtistRow): HomeArtist {
  return {
    id: r.id as ArtistId,
    displayName: r.profiles?.display_name ?? "Artist",
    avatarPath: r.profiles?.avatar_path ?? null,
    headline: r.headline,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    styles: (r.artist_styles ?? []).map((s) => s.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
  };
}

/** Featured = verified, accepting, top-rated. */
export async function fetchFeaturedArtists(client: InkoraClient, limit = 10): Promise<HomeArtist[]> {
  const { data, error } = await client
    .from("artists")
    .select(ARTIST_SELECT)
    .not("verified_at", "is", null)
    .eq("is_accepting", true)
    .order("rating_avg", { ascending: false })
    .order("rating_count", { ascending: false })
    .limit(limit)
    .returns<EmbeddedArtistRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(toHomeArtist);
}

/** All-time most-reviewed — the fallback when there's no recent momentum yet. */
async function fetchMostReviewed(client: InkoraClient, limit = 10): Promise<HomeArtist[]> {
  const { data, error } = await client
    .from("artists")
    .select(ARTIST_SELECT)
    .order("rating_count", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(limit)
    .returns<EmbeddedArtistRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(toHomeArtist);
}

/**
 * Trending = recent momentum (bookings×3 + reviews×2 + saves×1 over the last
 * 7 days), via the trending_artists RPC. Falls back to all-time most-reviewed
 * when nothing has moved recently (quiet week / fresh data) so the row is never
 * empty.
 */
export async function fetchTrendingArtists(client: InkoraClient, limit = 10): Promise<HomeArtist[]> {
  const { data, error } = await client.rpc("trending_artists", { p_days: 7, p_limit: limit });
  if (error) throw toAppError(error);
  const rows = (data ?? []).map((r) => ({
    id: r.id as ArtistId,
    displayName: r.display_name,
    avatarPath: r.avatar_path,
    headline: r.headline,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    styles: r.styles ?? [],
  }));
  return rows.length > 0 ? rows : fetchMostReviewed(client, limit);
}

/** Recommended = artists matching the user's weighted style preferences + proximity; falls back to featured. */
export async function fetchRecommendedForMe(client: InkoraClient, limit = 10): Promise<HomeArtist[]> {
  const { data: prefs } = await client
    .from("user_style_preferences")
    .select("weight, tattoo_styles(slug)")
    .order("weight", { ascending: false })
    .limit(6)
    .returns<{ weight: number; tattoo_styles: { slug: string } | null }[]>();
  const weighted = (prefs ?? [])
    .map((p) => ({ slug: p.tattoo_styles?.slug, weight: Number(p.weight) }))
    .filter((p): p is { slug: string; weight: number } => Boolean(p.slug));
  if (weighted.length === 0) return fetchFeaturedArtists(client, limit);

  // Proximity uses the user's own saved coordinates (owner-readable). Absent → neutral.
  const { data: userRes } = await client.auth.getUser();
  let lat: number | undefined;
  let lng: number | undefined;
  if (userRes.user) {
    const { data: coords } = await client
      .from("profiles_private")
      .select("latitude, longitude")
      .eq("id", userRes.user.id)
      .maybeSingle();
    lat = coords?.latitude ?? undefined;
    lng = coords?.longitude ?? undefined;
  }

  const { data, error } = await client.rpc("recommended_artists", {
    p_style_slugs: weighted.map((p) => p.slug),
    p_style_weights: weighted.map((p) => p.weight),
    p_lat: lat,
    p_lng: lng,
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
    styles: r.styles ?? [],
    matchedStyles: r.matched_styles ?? [],
    distanceKm: r.distance_km ?? null,
  }));
}

/** The user's top style-preference slugs (highest weight first). Empty when
 *  they haven't taken the style quiz — used both to detect that (Home shows a
 *  quiz CTA instead of a Recommended rail that would just mirror Featured) and
 *  to seed the Recommended rail's "See all" filter in Discover. */
export async function fetchMyStyleSlugs(client: InkoraClient, limit = 6): Promise<string[]> {
  const { data } = await client
    .from("user_style_preferences")
    .select("weight, tattoo_styles(slug)")
    .order("weight", { ascending: false })
    .limit(limit)
    .returns<{ weight: number; tattoo_styles: { slug: string } | null }[]>();
  return (data ?? []).map((p) => p.tattoo_styles?.slug).filter((x): x is string => Boolean(x));
}

export async function fetchNearbyStudios(
  client: InkoraClient,
  lat: number,
  lng: number,
  limit = 10,
): Promise<NearbyStudio[]> {
  const { data, error } = await client.rpc("nearby_studios", { p_lat: lat, p_lng: lng, p_limit: limit });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as StudioId,
    name: r.name,
    slug: r.slug,
    logoPath: r.logo_path,
    city: r.city,
    distanceKm: r.distance_km,
  }));
}

export async function fetchPromotions(client: InkoraClient): Promise<Promotion[]> {
  const { data, error } = await client
    .from("promotions")
    .select("id, title, subtitle, image_path, cta_label, cta_route")
    .order("sort_order", { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    imagePath: r.image_path,
    ctaLabel: r.cta_label,
    ctaRoute: r.cta_route,
  }));
}

/** Current user's saved location (for nearby studios); null if not set. */
export async function fetchMyLocation(client: InkoraClient): Promise<{ lat: number; lng: number } | null> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data } = await client.from("profiles_private").select("latitude, longitude").eq("id", uid).maybeSingle();
  const lat = (data as { latitude: number | null } | null)?.latitude;
  const lng = (data as { longitude: number | null } | null)?.longitude;
  return lat != null && lng != null ? { lat, lng } : null;
}

export interface IdeaFeedFilters {
  q?: string;
  styleSlugs?: string[];
  sort?: "recent" | "popular";
}

/** Infinite inspiration feed page, with optional keyword (title + description),
 *  style, and sort. Keyset paginates by created_at ("recent") or by
 *  (save_count, id) ("popular"). Style filtering is a server-side inner join on
 *  idea_styles, so the whole style corpus is reachable (no client-side id cap). */
export async function fetchIdeaFeedPage(
  client: InkoraClient,
  cursor: string | undefined,
  filters: IdeaFeedFilters = {},
  limit = 12,
): Promise<Page<IdeaCard>> {
  let styleIds: string[] | null = null;
  if (filters.styleSlugs && filters.styleSlugs.length > 0) {
    const { data: styleRows, error: sErr } = await client.from("tattoo_styles").select("id").in("slug", filters.styleSlugs);
    if (sErr) throw toAppError(sErr);
    styleIds = (styleRows ?? []).map((r) => r.id);
    if (styleIds.length === 0) return { items: [], nextCursor: null, hasMore: false };
  }

  // Inner-join idea_styles only when filtering (so parents are restricted to
  // matching styles); otherwise a plain embed to return each idea's styles.
  const styleEmbed = styleIds ? "idea_styles!inner(tattoo_styles(slug))" : "idea_styles(tattoo_styles(slug))";
  let q = client
    .from("tattoo_ideas")
    .select(`id, title, image_path, width, height, save_count, source_artist_id, created_at, ${styleEmbed}`)
    .eq("is_public", true)
    .eq("moderation_status", "approved")
    .is("deleted_at", null);
  if (styleIds) q = q.in("idea_styles.style_id", styleIds);
  const kw = filters.q?.trim();
  if (kw) {
    // Search title AND description (many ideas have no title). Strip characters
    // that would break the PostgREST or() filter grammar before interpolating.
    const term = kw.replace(/[,()%*\\]/g, " ").trim();
    if (term) q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  const popular = filters.sort === "popular";
  if (popular) {
    // Keyset on (save_count, id) so ties paginate stably. id (a uuid) is used as
    // the tiebreak rather than created_at to avoid timestamp encoding issues.
    q = q.order("save_count", { ascending: false }).order("id", { ascending: false }).limit(limit);
    if (cursor) {
      const [sc, lastId] = cursor.split("|");
      q = q.or(`save_count.lt.${Number(sc)},and(save_count.eq.${Number(sc)},id.lt.${lastId})`);
    }
  } else {
    q = q.order("created_at", { ascending: false }).limit(limit);
    if (cursor) q = q.lt("created_at", cursor);
  }

  const { data, error } = await q.returns<IdeaRow[]>();
  if (error) throw toAppError(error);

  const rows = data ?? [];
  const items: IdeaCard[] = rows.map((r) => ({
    id: r.id as IdeaId,
    title: r.title,
    imagePath: r.image_path,
    width: r.width,
    height: r.height,
    styleSlugs: (r.idea_styles ?? []).map((s) => s.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
    saveCount: r.save_count,
    sourceArtistId: (r.source_artist_id as ArtistId | null) ?? null,
  }));
  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last
    ? (popular ? `${last.save_count}|${last.id}` : last.created_at)
    : null;
  return { items, nextCursor, hasMore: nextCursor !== null };
}
