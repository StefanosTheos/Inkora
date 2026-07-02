import type {
  ArtistId, PortfolioImage, PortfolioImageId, ProfileId, ReviewId, ReviewItem, StudioId, StudioProfile,
} from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

interface RosterMember {
  status: string;
  artists: {
    id: string;
    headline: string | null;
    rating_avg: number;
    rating_count: number;
    profiles: { display_name: string; avatar_path: string | null } | null;
    artist_styles: { tattoo_styles: { slug: string } | null }[] | null;
  } | null;
}
interface StudioRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  bio: string | null;
  logo_path: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  opening_hours: Record<string, string[][]> | null;
  studio_memberships: RosterMember[] | null;
}

export async function getStudioProfile(client: InkoraClient, slug: string): Promise<StudioProfile | null> {
  const { data, error } = await client
    .from("studios")
    .select(
      "id, owner_id, name, slug, bio, logo_path, address_line, city, country, latitude, longitude, opening_hours, " +
        "studio_memberships(status, artists(id, headline, rating_avg, rating_count, profiles(display_name, avatar_path), artist_styles(tattoo_styles(slug))))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  const r = data as unknown as StudioRow;
  const roster = (r.studio_memberships ?? [])
    .filter((m) => m.status === "active" && m.artists)
    .map((m) => ({
      id: m.artists!.id as ArtistId,
      displayName: m.artists!.profiles?.display_name ?? "Artist",
      avatarPath: m.artists!.profiles?.avatar_path ?? null,
      headline: m.artists!.headline,
      ratingAvg: Number(m.artists!.rating_avg),
      ratingCount: m.artists!.rating_count,
      styles: (m.artists!.artist_styles ?? []).map((s) => s.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
    }));
  const styles = Array.from(new Set(roster.flatMap((a) => a.styles)));
  return {
    id: r.id as StudioId,
    ownerId: r.owner_id as ProfileId,
    name: r.name,
    slug: r.slug,
    bio: r.bio,
    logoPath: r.logo_path,
    addressLine: r.address_line,
    city: r.city,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    openingHours: r.opening_hours ?? {},
    styles,
    roster,
  };
}

/** Aggregate portfolio across the studio's resident artists. */
export async function getStudioPortfolio(client: InkoraClient, artistIds: string[]): Promise<PortfolioImage[]> {
  if (artistIds.length === 0) return [];
  const { data, error } = await client
    .from("portfolio_images")
    .select("id, artist_id, image_path, caption, placement, moderation_status")
    .in("artist_id", artistIds)
    .neq("moderation_status", "rejected")
    .order("sort_order", { ascending: true })
    .limit(40);
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as PortfolioImageId,
    artistId: r.artist_id as ArtistId,
    imagePath: r.image_path,
    caption: r.caption,
    placement: r.placement,
    moderationStatus: r.moderation_status,
  }));
}

interface StudioReviewRow {
  id: string;
  overall_rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
}
export async function getStudioReviews(client: InkoraClient, studioId: string): Promise<ReviewItem[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, overall_rating, title, body, created_at, profiles!reviews_author_id_fkey(display_name)")
    .eq("studio_id", studioId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw toAppError(error);
  return ((data ?? []) as unknown as StudioReviewRow[]).map((r) => ({
    id: r.id as ReviewId,
    authorName: r.profiles?.display_name ?? "Anonymous",
    overallRating: r.overall_rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
  }));
}

/** Map of artistId -> active weekday numbers (0=Sun..6=Sat) for a studio roster. */
export async function getRosterAvailability(client: InkoraClient, artistIds: string[]): Promise<Record<string, number[]>> {
  if (artistIds.length === 0) return {};
  const { data, error } = await client
    .from("artist_availability")
    .select("artist_id, day_of_week")
    .in("artist_id", artistIds)
    .eq("is_active", true);
  if (error) throw toAppError(error);
  const map: Record<string, Set<number>> = {};
  for (const r of data ?? []) (map[r.artist_id] ??= new Set()).add(r.day_of_week);
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.from(v).sort((a, b) => a - b)]));
}

export function useStudioProfile(client: InkoraClient, slug: string) {
  return useQuery({ queryKey: ["studio", slug], queryFn: () => getStudioProfile(client, slug), enabled: !!slug });
}
export function useStudioRosterAvailability(client: InkoraClient, artistIds: string[]) {
  return useQuery({
    queryKey: ["roster-availability", ...artistIds],
    queryFn: () => getRosterAvailability(client, artistIds),
    enabled: artistIds.length > 0,
  });
}
export function useStudioPortfolio(client: InkoraClient, artistIds: string[]) {
  return useQuery({
    queryKey: ["studio-portfolio", ...artistIds],
    queryFn: () => getStudioPortfolio(client, artistIds),
    enabled: artistIds.length > 0,
  });
}
export function useStudioReviews(client: InkoraClient, studioId: string) {
  return useQuery({ queryKey: ["studio-reviews", studioId], queryFn: () => getStudioReviews(client, studioId), enabled: !!studioId });
}
