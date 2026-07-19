import type {
  ArtistId, PortfolioImage, PortfolioImageId, ProfileId, ReviewId, ReviewItem, StatsPeriod, StudioApplication,
  StudioArtistStat, StudioBookingDetail, StudioCalendarBooking, StudioEditInput, StudioId, StudioOverview,
  StudioPeriodStat, StudioProfile,
} from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";
import { sendMessage, startStudioConversation } from "../messaging";

const STUDIO_SELECT =
  "id, owner_id, name, slug, bio, logo_path, email, phone, website, address_line, city, country, latitude, longitude, currency_code, opening_hours, " +
  "studio_memberships(status, suspension_reason, updated_at, artists(id, headline, rating_avg, rating_count, profiles(display_name, avatar_path), artist_styles(tattoo_styles(slug))))";

/** A membership that hasn't reached a terminal state — drives the Apply button. */
export type ActiveMembership = { studioId: string; status: "requested" | "invited" | "active" | "suspended" };
const NON_TERMINAL = ["requested", "invited", "active", "suspended"] as const;

interface RosterMember {
  status: string;
  suspension_reason: string | null;
  updated_at: string | null;
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
  currency_code: string | null;
  opening_hours: Record<string, string[][]> | null;
  studio_memberships: RosterMember[] | null;
}

function mapStudioRow(r: StudioRow): StudioProfile {
  const toArtist = (m: RosterMember) => ({
    id: m.artists!.id as ArtistId,
    displayName: m.artists!.profiles?.display_name ?? "Artist",
    avatarPath: m.artists!.profiles?.avatar_path ?? null,
    headline: m.artists!.headline,
    ratingAvg: Number(m.artists!.rating_avg),
    ratingCount: m.artists!.rating_count,
    styles: (m.artists!.artist_styles ?? []).map((s) => s.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
    suspensionReason: m.suspension_reason,
    suspendedAt: m.updated_at,
  });
  const members = (r.studio_memberships ?? []).filter((m) => m.artists);
  const roster = members.filter((m) => m.status === "active").map(toArtist);
  const suspended = members.filter((m) => m.status === "suspended").map(toArtist);
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
    currencyCode: r.currency_code ?? "EUR",
    openingHours: r.opening_hours ?? {},
    styles,
    roster,
    suspended,
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
  reply: string | null;
  replied_at: string | null;
  profiles: { display_name: string; avatar_path: string | null } | null;
}
export async function getStudioReviews(client: InkoraClient, studioId: string): Promise<ReviewItem[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, author_id, overall_rating, title, body, created_at, photo_paths, reply, replied_at, profiles!reviews_author_id_fkey(display_name, avatar_path)")
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
    reply: r.reply,
    repliedAt: r.replied_at,
  }));
}

/** Artist / studio owner posts (or clears, with an empty string) a public reply
 *  to a review. Server-guarded to the reviewed artist or the studio's owner. */
export async function replyToReview(client: InkoraClient, reviewId: string, reply: string): Promise<void> {
  const { error } = await client.rpc("reply_to_review", { p_review_id: reviewId, p_reply: reply });
  if (error) throw toAppError(error);
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

/** The caller's membership status for ONE studio, including terminal states
 *  ('removed'), so an applicant can see whether their application was accepted,
 *  declined/expired, or still pending. RLS lets an artist read their own row. */
export async function getMyStudioMembershipStatus(client: InkoraClient, studioId: string): Promise<string | null> {
  if (!studioId) return null;
  const { data: u } = await client.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data, error } = await client
    .from("studio_memberships")
    .select("status")
    .eq("studio_id", studioId)
    .eq("artist_id", uid)
    .maybeSingle<{ status: string }>();
  if (error) throw toAppError(error);
  return data?.status ?? null;
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

/** Owner suspends / removes / reactivates a roster member. */
export async function studioSetMembership(client: InkoraClient, studioId: string, artistId: string, status: "active" | "suspended" | "removed", reason?: string): Promise<void> {
  const { error } = await client.rpc("studio_set_membership", { p_studio_id: studioId, p_artist_id: artistId, p_status: status, p_reason: reason ?? null });
  if (error) throw toAppError(error);
}

/** Owner invites an artist to the studio (artist then accepts/declines). */
export async function studioInviteArtist(client: InkoraClient, studioId: string, artistId: string): Promise<void> {
  const { error } = await client.rpc("studio_invite_artist", { p_studio_id: studioId, p_artist_id: artistId });
  if (error) throw toAppError(error);
}

/** Artist accepts or declines a studio invitation. */
export async function respondStudioInvite(client: InkoraClient, studioId: string, accept: boolean): Promise<void> {
  const { error } = await client.rpc("respond_studio_invite", { p_studio_id: studioId, p_accept: accept });
  if (error) throw toAppError(error);
}

/** A candidate artist in the studio-owner invite/scouting search. */
export interface InviteArtist {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  city: string | null;
  ratingAvg: number;
  ratingCount: number;
  styles: string[]; // style slugs
}
/** Filters for the invite search. All optional — an empty filter returns the
 *  top artists (for open-ended scouting). */
export interface InviteSearchFilters {
  query?: string;
  city?: string;
  style?: string; // a single style slug
  minRating?: number;
}
interface InviteArtistRow {
  id: string;
  display_name: string;
  avatar_path: string | null;
  city: string | null;
  artists: {
    headline: string | null;
    rating_avg: number;
    rating_count: number;
    artist_styles: { tattoo_styles: { slug: string } | null }[] | null;
  } | null;
}
/** Search/scout artists for the invite picker. Name/city/style/min-rating filter
 *  server-side; callers sort the result (by rating, reviews, name) client-side. */
export async function searchArtistsForInvite(client: InkoraClient, filters: InviteSearchFilters): Promise<InviteArtist[]> {
  const style = filters.style?.trim();
  // When filtering by style we must inner-join the join tables; that also trims
  // the returned styles to the matched one (acceptable — it's the filtered style).
  const stylesEmbed = style ? "artist_styles!inner(tattoo_styles!inner(slug))" : "artist_styles(tattoo_styles(slug))";
  let qb = client
    .from("profiles")
    .select(`id, display_name, avatar_path, city, artists!inner(headline, rating_avg, rating_count, ${stylesEmbed})`);
  const name = filters.query?.trim();
  if (name) qb = qb.ilike("display_name", `%${name}%`);
  const city = filters.city?.trim();
  if (city) qb = qb.ilike("city", `%${city}%`);
  if (style) qb = qb.eq("artists.artist_styles.tattoo_styles.slug", style);
  if (filters.minRating && filters.minRating > 0) qb = qb.gte("artists.rating_avg", filters.minRating);
  const { data, error } = await qb.limit(50).returns<InviteArtistRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ArtistId,
    displayName: r.display_name,
    avatarPath: r.avatar_path,
    headline: r.artists?.headline ?? null,
    city: r.city,
    ratingAvg: Number(r.artists?.rating_avg ?? 0),
    ratingCount: r.artists?.rating_count ?? 0,
    styles: (r.artists?.artist_styles ?? []).map((sr) => sr.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
  }));
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

export function useMyStudioMembershipStatus(client: InkoraClient, studioId: string) {
  return useQuery({
    queryKey: ["my-studio-membership-status", studioId],
    queryFn: () => getMyStudioMembershipStatus(client, studioId),
    enabled: !!studioId,
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
    completed_bookings: number; scheduled_bookings: number; cancelled_bookings: number; no_show_bookings: number;
    revenue: number; studio_saves: number; rating_avg: number; rating_count: number;
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
    noShowBookings: r.no_show_bookings,
    revenue: Number(r.revenue),
    studioSaves: r.studio_saves,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
  };
}

export async function getStudioArtistStats(client: InkoraClient, studioId: string): Promise<StudioArtistStat[]> {
  const { data, error } = await client.rpc("studio_artist_stats", { p_studio_id: studioId }).returns<{
    artist_id: string; rating_avg: number; rating_count: number; saved_by: number; work_saves: number;
    completed: number; scheduled: number; cancelled: number; no_show: number; profile_visits: number; revenue: number;
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
    noShow: r.no_show,
    profileVisits: r.profile_visits,
    revenue: Number(r.revenue),
  }));
}

/** Current + previous window bounds for a stats period. Previous is the same
 *  elapsed length immediately before the current window, so MTD/YTD compare
 *  like-for-like (e.g. "this month so far" vs "same span of last month"). */
function periodRanges(period: StatsPeriod): { curStart: string; curEnd: string; prevStart: string; prevEnd: string } {
  const now = new Date();
  const curEnd = now;
  let curStart: Date;
  let prevStart: Date;
  let prevEnd: Date;
  if (period === "wtd") {
    // Week-to-date, weeks starting Monday; prior window is the same elapsed
    // span of last week, for a like-for-like comparison (as MTD/YTD do).
    const daysSinceMonday = (now.getDay() + 6) % 7;
    curStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    const elapsed = now.getTime() - curStart.getTime();
    prevStart = new Date(curStart.getTime() - 7 * 86_400_000);
    prevEnd = new Date(prevStart.getTime() + elapsed);
  } else if (period === "mtd") {
    curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const elapsed = now.getTime() - curStart.getTime();
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(prevStart.getTime() + elapsed);
  } else {
    curStart = new Date(now.getFullYear(), 0, 1);
    const elapsed = now.getTime() - curStart.getTime();
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = new Date(prevStart.getTime() + elapsed);
  }
  return { curStart: curStart.toISOString(), curEnd: curEnd.toISOString(), prevStart: prevStart.toISOString(), prevEnd: prevEnd.toISOString() };
}

export async function getStudioOverviewPeriod(
  client: InkoraClient,
  studioId: string,
  period: StatsPeriod,
): Promise<StudioPeriodStat | null> {
  const { curStart, curEnd, prevStart, prevEnd } = periodRanges(period);
  const { data, error } = await client.rpc("studio_overview_period", {
    p_studio_id: studioId,
    p_cur_start: curStart,
    p_cur_end: curEnd,
    p_prev_start: prevStart,
    p_prev_end: prevEnd,
  }).returns<{
    completed: number; cancelled: number; no_show: number; revenue: number; profile_visits: number;
    prev_completed: number; prev_cancelled: number; prev_no_show: number; prev_revenue: number; prev_profile_visits: number;
  }[]>();
  if (error) throw toAppError(error);
  const r = data?.[0];
  if (!r) return null;
  return {
    completed: r.completed,
    cancelled: r.cancelled,
    noShow: r.no_show,
    revenue: Number(r.revenue),
    profileVisits: r.profile_visits,
    prevCompleted: r.prev_completed,
    prevCancelled: r.prev_cancelled,
    prevNoShow: r.prev_no_show,
    prevRevenue: Number(r.prev_revenue),
    prevProfileVisits: r.prev_profile_visits,
  };
}

export function useStudioOverviewPeriod(client: InkoraClient, studioId: string, period: StatsPeriod) {
  return useQuery({
    queryKey: ["studio-overview-period", studioId, period],
    queryFn: () => getStudioOverviewPeriod(client, studioId, period),
    enabled: !!studioId,
  });
}

/** Every completed booking for a studio within [start, end) — the insights
 *  drill-down. Boundaries are ISO timestamps the caller computes from the local
 *  day/week/month it's showing. */
export async function getStudioCompletedBookings(
  client: InkoraClient,
  studioId: string,
  startISO: string,
  endISO: string,
): Promise<StudioBookingDetail[]> {
  const { data, error } = await client.rpc("studio_completed_bookings", {
    p_studio_id: studioId,
    p_start: startISO,
    p_end: endISO,
  });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    appointmentId: r.appointment_id,
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
    durationMinutes: Math.max(0, Math.round((new Date(r.scheduled_end).getTime() - new Date(r.scheduled_start).getTime()) / 60000)),
    priceAmount: r.price_amount == null ? null : Number(r.price_amount),
    artistId: r.artist_id as ProfileId,
    artistName: r.artist_name,
    artistAvatarPath: r.artist_avatar,
    clientId: r.client_id as ProfileId,
    clientName: r.client_name,
    clientAvatarPath: r.client_avatar,
    title: r.title,
    placement: r.placement,
    approxSize: r.approx_size,
    isColor: r.is_color,
  }));
}

export function useStudioCompletedBookings(client: InkoraClient, studioId: string, startISO: string, endISO: string) {
  return useQuery({
    queryKey: ["studio-completed-bookings", studioId, startISO, endISO],
    queryFn: () => getStudioCompletedBookings(client, studioId, startISO, endISO),
    enabled: !!studioId && !!startISO && !!endISO,
  });
}

/** Upcoming (scheduled/rescheduled) + completed bookings for the studio owner's
 *  calendar, within [start, end). */
export async function getStudioCalendarBookings(
  client: InkoraClient,
  studioId: string,
  startISO: string,
  endISO: string,
): Promise<StudioCalendarBooking[]> {
  const { data, error } = await client.rpc("studio_calendar_bookings", {
    p_studio_id: studioId,
    p_start: startISO,
    p_end: endISO,
  });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    appointmentId: r.appointment_id,
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
    status: r.status as StudioCalendarBooking["status"],
    durationMinutes: Math.max(0, Math.round((new Date(r.scheduled_end).getTime() - new Date(r.scheduled_start).getTime()) / 60000)),
    priceAmount: r.price_amount == null ? null : Number(r.price_amount),
    artistId: r.artist_id as ProfileId,
    artistName: r.artist_name,
    artistAvatarPath: r.artist_avatar,
    clientId: r.client_id as ProfileId,
    clientName: r.client_name,
    clientAvatarPath: r.client_avatar,
    title: r.title,
    placement: r.placement,
    approxSize: r.approx_size,
    isColor: r.is_color,
  }));
}

export function useStudioCalendarBookings(client: InkoraClient, studioId: string, startISO: string, endISO: string) {
  return useQuery({
    queryKey: ["studio-calendar-bookings", studioId, startISO, endISO],
    queryFn: () => getStudioCalendarBookings(client, studioId, startISO, endISO),
    enabled: !!studioId && !!startISO && !!endISO,
  });
}

/** Update the owner's studio (name, about, contact, city/address, hours, logo,
 *  currency). A null logoPath leaves the existing logo unchanged. */
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
    p_logo_path: input.logoPath,
    p_currency_code: input.currencyCode,
  });
  if (error) throw toAppError(error);
}

/** Upload a new studio logo. Stored in the public `avatars` bucket under the
 *  owner's uid folder (storage RLS keys writes to that folder). Returns the path
 *  to persist on the studio; caller passes it to updateStudio. */
export async function uploadStudioLogo(client: InkoraClient, body: ArrayBuffer | Blob, contentType: string, ext: string): Promise<string> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError({ message: "unauthenticated" });
  const objectPath = `${uid}/studio-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("avatars").upload(objectPath, body, { contentType, upsert: false });
  if (error) throw toAppError(error);
  return `avatars/${objectPath}`;
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
