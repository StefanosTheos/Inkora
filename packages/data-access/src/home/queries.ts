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

/** Trending = most-reviewed (popularity proxy). */
export async function fetchTrendingArtists(client: InkoraClient, limit = 10): Promise<HomeArtist[]> {
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

/** Recommended = artists overlapping the user's onboarding style preferences; falls back to featured. */
export async function fetchRecommendedForMe(client: InkoraClient, limit = 10): Promise<HomeArtist[]> {
  const { data: prefs } = await client
    .from("user_style_preferences")
    .select("weight, tattoo_styles(slug)")
    .order("weight", { ascending: false })
    .limit(5)
    .returns<{ tattoo_styles: { slug: string } | null }[]>();
  const slugs = (prefs ?? [])
    .map((p) => p.tattoo_styles?.slug)
    .filter((x): x is string => Boolean(x));
  if (slugs.length === 0) return fetchFeaturedArtists(client, limit);

  const { data, error } = await client.rpc("recommended_artists", { p_style_slugs: slugs, p_limit: limit });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ArtistId,
    displayName: r.display_name,
    avatarPath: r.avatar_path,
    headline: r.headline,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    styles: r.styles ?? [],
  }));
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

/** Infinite inspiration feed page (keyset by created_at). */
export async function fetchIdeaFeedPage(client: InkoraClient, cursor?: string, limit = 12): Promise<Page<IdeaCard>> {
  let q = client
    .from("tattoo_ideas")
    .select("id, title, image_path, width, height, save_count, source_artist_id, created_at, idea_styles(tattoo_styles(slug))")
    .eq("is_public", true)
    .eq("moderation_status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("created_at", cursor);

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
  const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.created_at ?? null) : null;
  return { items, nextCursor, hasMore: nextCursor !== null };
}
