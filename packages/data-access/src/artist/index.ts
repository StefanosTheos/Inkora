import type {
  ArtistId, ArtistOffer, ArtistProfile, AvailabilitySlot, PortfolioImage, PortfolioImageId, ReviewId, ReviewItem, StudioId,
} from "@inkora/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

// ------------------------------------------------------------------ profile header
interface ArtistRow {
  id: string;
  headline: string | null;
  years_experience: number | null;
  hourly_rate: number | null;
  min_charge: number | null;
  currency_code: string;
  rating_avg: number;
  rating_count: number;
  is_accepting: boolean;
  verified_at: string | null;
  instagram_handle: string | null;
  profiles: { display_name: string; username: string | null; avatar_path: string | null; bio: string | null; city: string | null } | null;
  artist_styles: { tattoo_styles: { slug: string } | null }[] | null;
  studio_memberships: { status: string; studios: { id: string; name: string; slug: string } | null }[] | null;
}

export async function getArtistProfile(client: InkoraClient, id: string): Promise<ArtistProfile | null> {
  const { data, error } = await client
    .from("artists")
    .select(
      "id, headline, years_experience, hourly_rate, min_charge, currency_code, rating_avg, rating_count, is_accepting, verified_at, instagram_handle, profiles!inner(display_name, username, avatar_path, bio, city), artist_styles(tattoo_styles(slug)), studio_memberships(status, studios(id, name, slug))",
    )
    .eq("id", id)
    .maybeSingle<ArtistRow>();
  if (error) throw toAppError(error);
  if (!data) return null;
  const r = data;
  return {
    id: r.id as ArtistId,
    displayName: r.profiles?.display_name ?? "Artist",
    username: r.profiles?.username ?? null,
    avatarPath: r.profiles?.avatar_path ?? null,
    bio: r.profiles?.bio ?? null,
    city: r.profiles?.city ?? null,
    headline: r.headline,
    yearsExperience: r.years_experience,
    hourlyRate: r.hourly_rate,
    minCharge: r.min_charge,
    currencyCode: r.currency_code,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    isAccepting: r.is_accepting,
    verified: r.verified_at != null,
    instagram: r.instagram_handle,
    styles: (r.artist_styles ?? []).map((s) => s.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
    studios: (r.studio_memberships ?? [])
      .filter((m) => m.status === "active" && m.studios)
      .map((m) => ({ id: m.studios!.id as StudioId, name: m.studios!.name, slug: m.studios!.slug })),
  };
}

// ------------------------------------------------------------------ portfolio
export async function getArtistPortfolio(client: InkoraClient, id: string): Promise<PortfolioImage[]> {
  const { data, error } = await client
    .from("portfolio_images")
    .select("id, image_path, caption, placement, moderation_status")
    .eq("artist_id", id)
    .neq("moderation_status", "rejected")
    .order("sort_order", { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as PortfolioImageId,
    artistId: id as ArtistId,
    imagePath: r.image_path,
    caption: r.caption,
    placement: r.placement,
    moderationStatus: r.moderation_status,
  }));
}

// ------------------------------------------------------------------ reviews
interface ReviewRow {
  id: string;
  overall_rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
}
export async function getArtistReviews(client: InkoraClient, id: string): Promise<ReviewItem[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, overall_rating, title, body, created_at, profiles!reviews_author_id_fkey(display_name)")
    .eq("artist_id", id)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .returns<ReviewRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ReviewId,
    authorName: r.profiles?.display_name ?? "Anonymous",
    overallRating: r.overall_rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
  }));
}

// ------------------------------------------------------------------ offers
export async function getArtistOffers(client: InkoraClient, id: string): Promise<ArtistOffer[]> {
  const { data, error } = await client
    .from("artist_offers")
    .select("id, title, description, price_amount, currency_code")
    .eq("artist_id", id)
    .order("sort_order", { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priceAmount: r.price_amount,
    currencyCode: r.currency_code,
  }));
}

// ------------------------------------------------------------------ availability
export async function getArtistAvailability(client: InkoraClient, id: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await client
    .from("artist_availability")
    .select("day_of_week, start_time, end_time")
    .eq("artist_id", id)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({ dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time }));
}

// ------------------------------------------------------------------ save (favorite)
/** Whether the current user has saved this artist (RLS scopes favorites to the owner). */
export async function isArtistSaved(client: InkoraClient, artistId: string): Promise<boolean> {
  const { data, error } = await client
    .from("favorites")
    .select("id")
    .eq("target_type", "artist")
    .eq("target_id", artistId)
    .maybeSingle<{ id: string }>();
  if (error) throw toAppError(error);
  return data != null;
}

/** Add/remove this artist from the current user's saved artists. */
export async function setArtistSaved(client: InkoraClient, artistId: string, saved: boolean): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError(new Error("You need to sign in to save artists."));
  if (saved) {
    // unique(profile_id, target_type, target_id) makes this idempotent; ignoring
    // duplicates avoids errors and stops re-saving from re-triggering the reward.
    const { error } = await client
      .from("favorites")
      .upsert(
        { profile_id: uid, target_type: "artist", target_id: artistId },
        { onConflict: "profile_id,target_type,target_id", ignoreDuplicates: true },
      );
    if (error) throw toAppError(error);
  } else {
    const { error } = await client
      .from("favorites")
      .delete()
      .eq("profile_id", uid)
      .eq("target_type", "artist")
      .eq("target_id", artistId);
    if (error) throw toAppError(error);
  }
}

// ------------------------------------------------------------------ edit own artist profile
export interface ArtistProfileEdit {
  headline?: string | null;
  hourlyRate?: number | null;
  minCharge?: number | null;
  instagram?: string | null;
  isAccepting?: boolean;
}
/** Update the caller's own artists row (RLS: artists_write_own). */
export async function updateArtistProfile(client: InkoraClient, input: ArtistProfileEdit): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError(new Error("Not signed in"));
  const patch: Record<string, unknown> = {};
  if (input.headline !== undefined) patch.headline = input.headline;
  if (input.hourlyRate !== undefined) patch.hourly_rate = input.hourlyRate;
  if (input.minCharge !== undefined) patch.min_charge = input.minCharge;
  if (input.instagram !== undefined) patch.instagram_handle = input.instagram;
  if (input.isAccepting !== undefined) patch.is_accepting = input.isAccepting;
  const { error } = await client.from("artists").update(patch).eq("id", uid);
  if (error) throw toAppError(error);
}

// ------------------------------------------------------------------ artist audience stats
export interface ArtistStats {
  savedBy: number;
  designSaves: number;
}
export async function getArtistStats(client: InkoraClient, artistId?: string): Promise<ArtistStats> {
  const { data, error } = await client
    .rpc("artist_stats", { p_artist_id: artistId ?? undefined })
    .returns<{ saved_by: number; design_saves: number }[]>();
  if (error) throw toAppError(error);
  const row = data?.[0];
  return { savedBy: row?.saved_by ?? 0, designSaves: row?.design_saves ?? 0 };
}
export function useArtistStats(client: InkoraClient, artistId?: string) {
  return useQuery({ queryKey: ["artist-stats", artistId ?? "me"], queryFn: () => getArtistStats(client, artistId) });
}

// ------------------------------------------------------------------ hooks
/** Saved state + optimistic toggle for one artist. Refreshes the dashboard's
 *  saved list. Saving is pure curation — it does not award points. */
export function useArtistSaved(client: InkoraClient, artistId: string) {
  const qc = useQueryClient();
  const key = ["artist-saved", artistId] as const;
  const q = useQuery({ queryKey: key, queryFn: () => isArtistSaved(client, artistId), enabled: !!artistId });
  const saved = q.data ?? false;
  const mutation = useMutation({
    mutationFn: (next: boolean) => setArtistSaved(client, artistId, next),
    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<boolean>(key);
      qc.setQueryData<boolean>(key, next);
      return { prev };
    },
    onError: (_e, _next, ctx) => {
      if (ctx) qc.setQueryData<boolean>(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["saved-artists"] }); // dashboardKeys.savedArtists
    },
  });
  return { saved, isLoading: q.isLoading, isToggling: mutation.isPending, toggle: () => mutation.mutate(!saved) };
}

export function useArtistProfile(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["artist", id], queryFn: () => getArtistProfile(client, id), enabled: !!id });
}
export function useArtistPortfolio(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["artist-portfolio", id], queryFn: () => getArtistPortfolio(client, id), enabled: !!id });
}
export function useArtistReviews(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["artist-reviews", id], queryFn: () => getArtistReviews(client, id), enabled: !!id });
}
export function useArtistOffers(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["artist-offers", id], queryFn: () => getArtistOffers(client, id), enabled: !!id });
}
export function useArtistAvailability(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["artist-availability", id], queryFn: () => getArtistAvailability(client, id), enabled: !!id });
}
