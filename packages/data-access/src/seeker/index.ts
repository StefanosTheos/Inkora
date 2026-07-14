import type { ClientReviewItem, ProfileId, PublicSeekerProfile, ReviewId, SeekerReview } from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

interface RpcRow {
  id: string;
  display_name: string;
  username: string | null;
  avatar_path: string | null;
  city: string | null;
  bio: string | null;
  member_since: string;
  bookings_count: number;
  reviews_count: number;
}

export async function getPublicSeekerProfile(client: InkoraClient, profileId: string): Promise<PublicSeekerProfile | null> {
  const { data, error } = await client
    .rpc("public_seeker_profile", { p_profile_id: profileId })
    .returns<RpcRow[]>();
  if (error) throw toAppError(error);
  const r = data?.[0];
  if (!r) return null;
  return {
    id: r.id as ProfileId,
    displayName: r.display_name,
    username: r.username,
    avatarPath: r.avatar_path,
    city: r.city,
    bio: r.bio,
    memberSince: r.member_since,
    bookingsCount: r.bookings_count,
    reviewsCount: r.reviews_count,
  };
}

interface WrittenReviewRow {
  id: string;
  appointment_id: string | null;
  overall_rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  photo_paths: string[] | null;
  artists: { profiles: { display_name: string } | null } | null;
  studios: { name: string } | null;
}

/** Reviews written BY this seeker (published), newest first. */
export async function getSeekerReviews(client: InkoraClient, authorId: string): Promise<SeekerReview[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, appointment_id, overall_rating, title, body, created_at, photo_paths, artists(profiles(display_name)), studios(name)")
    .eq("author_id", authorId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<WrittenReviewRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ReviewId,
    appointmentId: (r.appointment_id as SeekerReview["appointmentId"]) ?? null,
    subjectName: r.studios?.name ?? r.artists?.profiles?.display_name ?? "Artist",
    overallRating: r.overall_rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    photoPaths: r.photo_paths ?? [],
  }));
}

interface ClientReviewRow {
  id: string;
  author_name: string;
  author_avatar: string | null;
  punctuality: number;
  communication: number;
  preparedness: number;
  sat_well: number;
  respect: number;
  overall: number;
  comment: string | null;
  text_locked: boolean;
  created_at: string;
}

/** Reviews artists have written ABOUT this client (newest first). The RPC only
 *  returns rows to an artist or to the subject client, and withholds the
 *  written comment until the double-blind window unlocks it. */
export async function getClientReviews(client: InkoraClient, clientId: string): Promise<ClientReviewItem[]> {
  const { data, error } = await client
    .rpc("client_reviews_for", { p_client_id: clientId })
    .returns<ClientReviewRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    authorName: r.author_name,
    authorAvatarPath: r.author_avatar,
    punctuality: r.punctuality,
    communication: r.communication,
    preparedness: r.preparedness,
    satWell: r.sat_well,
    respect: r.respect,
    overall: r.overall,
    comment: r.comment,
    textLocked: r.text_locked,
    createdAt: r.created_at,
  }));
}

export function usePublicSeekerProfile(client: InkoraClient, profileId: string) {
  return useQuery({ queryKey: ["seeker", profileId], queryFn: () => getPublicSeekerProfile(client, profileId), enabled: !!profileId });
}
export function useSeekerReviews(client: InkoraClient, authorId: string) {
  return useQuery({ queryKey: ["seeker-reviews", authorId], queryFn: () => getSeekerReviews(client, authorId), enabled: !!authorId });
}
export function useClientReviews(client: InkoraClient, clientId: string, enabled = true) {
  return useQuery({ queryKey: ["client-reviews", clientId], queryFn: () => getClientReviews(client, clientId), enabled: enabled && !!clientId });
}
