import type {
  ArtistId, PortfolioImage, PortfolioImageId, ProfileId, ReviewId, ReviewItem, StudioApplication,
  StudioArtistStat, StudioEditInput, StudioId, StudioOverview, StudioProfile,
} from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";
import { sendMessage, startStudioConversation } from "../messaging";

const STUDIO_SELECT =
  "id, owner_id, name, slug, bio, logo_path, email, phone, website, address_line, city, country, latitude, longitude, opening_hours, " +
  "studio_memberships(status, artists(id, headline, rating_avg, rating_count, profiles(display_name, avatar_path), artist_styles(tattoo_styles(slug))))";

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
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  opening_hours: Record<string, string[][]> | null;
  studio_memberships: RosterMember[] | null;
}

function mapStudioRow(r: StudioRow): StudioProfile {
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
    email: r.email,
    phone: r.phone,
    website: r.website,
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

export async function getStudioProfile(client: InkoraClient, slug: string): Promise<StudioProfile | null> {
  const { data, error } = await client.from("studios").select(STUDIO_SELECT).eq("slug", slug).maybeSingle<StudioRow>();
  if (error) throw toAppError(error);
  return data ? mapStudioRow(data) : null;
}

/** The studio owned by the current user (studio-owner dashboard). */
export async function getMyStudio(client: InkoraClient, ownerId: string): Promise<StudioProfile | null> {
  if (!ownerId) return null;
  const { data, error } = await client.from("studios").select(STUDIO_SELECT).eq("owner_id", ownerId).maybeSingle<StudioRow>();
  if (error) throw toAppError(error);
  return data ? mapStudioRow(data) : null;
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
  // Surface the application in the owner's chat so they can respond there too.
  try {
    const { data: u } = await client.auth.getUser();
    const me = u.user?.id;
    const cid = await startStudioConversation(client, studioId);
    if (me && cid) {
      await sendMessage(client, cid, me, {
        type: "booking_card",
        body: "🎨 Application to join your studio",
        metadata: { kind: "application", studioId },
      });
    }
  } catch { /* the application chat card is best-effort */ }
  return (data as string) ?? "requested";
}

/** Owner accepts or rejects a pending application. */
export async function respondStudioApplication(client: InkoraClient, studioId: string, artistId: string, accept: boolean): Promise<void> {
  const { error } = await client.rpc("respond_studio_application", { p_studio_id: studioId, p_artist_id: artistId, p_accept: accept });
  if (error) throw toAppError(error);
}

/** Pending applications to a studio (owner inbox), oldest first. */
export async function getStudioApplications(client: InkoraClient, studioId: string): Promise<StudioApplication[]> {
  const { data, error } = await client.rpc("studio_applications", { p_studio_id: studioId }).returns<{
    artist_id: string; display_name: string; avatar_path: string | null; headline: string | null;
    rating_avg: number; rating_count: number; applied_at: string;
  }[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    artistId: r.artist_id as ArtistId,
    displayName: r.display_name,
    avatarPath: r.avatar_path,
    headline: r.headline,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    appliedAt: r.applied_at,
  }));
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

// ---- Studio-owner dashboard: stats + visit tracking -----------------

export async function getStudioOverview(client: InkoraClient, studioId: string): Promise<StudioOverview | null> {
  const { data, error } = await client.rpc("studio_overview", { p_studio_id: studioId }).returns<{
    active_artists: number; pending_applications: number; profile_visits: number;
    completed_bookings: number; scheduled_bookings: number; cancelled_bookings: number;
  }[]>();
  if (error) throw toAppError(error);
  const r = data?.[0];
  if (!r) return null;
  return {
    activeArtists: r.active_artists,
    pendingApplications: r.pending_applications,
    profileVisits: r.profile_visits,
    completedBookings: r.completed_bookings,
    scheduledBookings: r.scheduled_bookings,
    cancelledBookings: r.cancelled_bookings,
  };
}

export async function getStudioArtistStats(client: InkoraClient, studioId: string): Promise<StudioArtistStat[]> {
  const { data, error } = await client.rpc("studio_artist_stats", { p_studio_id: studioId }).returns<{
    artist_id: string; rating_avg: number; rating_count: number; saved_by: number; work_saves: number;
    completed: number; scheduled: number; cancelled: number; profile_visits: number;
  }[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    artistId: r.artist_id as ArtistId,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    savedBy: r.saved_by,
    workSaves: r.work_saves,
    completed: r.completed,
    scheduled: r.scheduled,
    cancelled: r.cancelled,
    profileVisits: r.profile_visits,
  }));
}

/** Update the owner's studio (name, about, contact, city/address, hours). */
export async function updateStudio(client: InkoraClient, studioId: string, input: StudioEditInput): Promise<void> {
  const { error } = await client.rpc("update_studio", {
    p_studio_id: studioId,
    p_name: input.name,
    p_bio: input.bio,
    p_email: input.email,
    p_phone: input.phone,
    p_website: input.website,
    p_address_line: input.addressLine,
    p_city: input.city,
    p_opening_hours: input.openingHours,
  });
  if (error) throw toAppError(error);
}

/** Log a view of an artist/studio profile (best-effort; dedupes server-side). */
export async function recordProfileVisit(client: InkoraClient, targetType: "artist" | "studio", targetId: string): Promise<void> {
  if (!targetId) return;
  await client.rpc("record_profile_visit", { p_target_type: targetType, p_target_id: targetId });
}

export function useMyStudio(client: InkoraClient, ownerId: string) {
  return useQuery({ queryKey: ["my-studio", ownerId], queryFn: () => getMyStudio(client, ownerId), enabled: !!ownerId });
}
export function useStudioOverview(client: InkoraClient, studioId: string) {
  return useQuery({ queryKey: ["studio-overview", studioId], queryFn: () => getStudioOverview(client, studioId), enabled: !!studioId });
}
export function useStudioArtistStats(client: InkoraClient, studioId: string) {
  return useQuery({ queryKey: ["studio-artist-stats", studioId], queryFn: () => getStudioArtistStats(client, studioId), enabled: !!studioId });
}
export function useStudioApplications(client: InkoraClient, studioId: string) {
  return useQuery({ queryKey: ["studio-applications", studioId], queryFn: () => getStudioApplications(client, studioId), enabled: !!studioId });
}
