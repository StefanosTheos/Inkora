import type {
  ArtistId, PortfolioImage, PortfolioImageId, ProfileId, ReviewId, ReviewItem, StudioId, StudioProfile,
} from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

/** A membership that hasn't reached a terminal state — drives the Apply button. */
export type ActiveMembership = { studioId: string; status: "requested" | "invited" | "active" | "suspended" };
const NON_TERMINAL = ["requested", "invited", "active", "suspended"] as const;

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
    .maybeSingle<StudioRow>();
  if (error) throw toAppError(error);
  if (!data) return null;
  const r = data;
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
  author_id: string | null;
  overall_rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  photo_paths: string[] | null;
  profiles: { display_name: string; avatar_path: string | null } | null;
}
export async function getStudioReviews(client: InkoraClient, studioId: string): Promise<ReviewItem[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, author_id, overall_rating, title, body, created_at, photo_paths, profiles!reviews_author_id_fkey(display_name, avatar_path)")
    .eq("studio_id", studioId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .returns<StudioReviewRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ReviewId,
    authorId: (r.author_id as ReviewItem["authorId"]) ?? null,
    authorName: r.profiles?.display_name ?? "Anonymous",
    authorAvatarPath: r.profiles?.avatar_path ?? null,
    overallRating: r.overall_rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    photoPaths: r.photo_paths ?? [],
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

// ---- Artist → studio applications -----------------------------------

/** The caller's current non-terminal membership (or null). Used to decide
 *  whether an artist can apply to a studio and what state to show. */
export async function getMyMembership(client: InkoraClient, artistId: string): Promise<ActiveMembership | null> {
  if (!artistId) return null;
  const { data, error } = await client
    .from("studio_memberships")
    .select("studio_id, status")
    .eq("artist_id", artistId)
    .in("status", NON_TERMINAL as unknown as string[])
    .maybeSingle<{ studio_id: string; status: ActiveMembership["status"] }>();
  if (error) throw toAppError(error);
  return data ? { studioId: data.studio_id, status: data.status } : null;
}

/** Artist applies to work at a studio. Returns the resulting status ('requested'). */
export async function applyToStudio(client: InkoraClient, studioId: string): Promise<string> {
  const { data, error } = await client.rpc("apply_to_studio", { p_studio_id: studioId });
  if (error) throw toAppError(error);
  return (data as string) ?? "requested";
}

/** Artist withdraws their own pending application. */
export async function withdrawStudioApplication(client: InkoraClient, studioId: string): Promise<void> {
  const { error } = await client.rpc("withdraw_studio_application", { p_studio_id: studioId });
  if (error) throw toAppError(error);
}

export function useMyMembership(client: InkoraClient, artistId: string) {
  return useQuery({
    queryKey: ["my-membership", artistId],
    queryFn: () => getMyMembership(client, artistId),
    enabled: !!artistId,
  });
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
