import type { ProfileId, PublicSeekerProfile, ReviewId, SeekerReview } from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

interface RpcRow {
  id: string;
  display_name: string;
  username: string | null;
  avatar_path: string | null;
  city: string | null;
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
    memberSince: r.member_since,
    bookingsCount: r.bookings_count,
    reviewsCount: r.reviews_count,
  };
}

interface WrittenReviewRow {
  id: string;
  overall_rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  artists: { profiles: { display_name: string } | null } | null;
  studios: { name: string } | null;
}

/** Reviews written BY this seeker (published), newest first. */
export async function getSeekerReviews(client: InkoraClient, authorId: string): Promise<SeekerReview[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, overall_rating, title, body, created_at, artists(profiles(display_name)), studios(name)")
    .eq("author_id", authorId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<WrittenReviewRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as ReviewId,
    subjectName: r.studios?.name ?? r.artists?.profiles?.display_name ?? "Artist",
    overallRating: r.overall_rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export function usePublicSeekerProfile(client: InkoraClient, profileId: string) {
  return useQuery({ queryKey: ["seeker", profileId], queryFn: () => getPublicSeekerProfile(client, profileId), enabled: !!profileId });
}
export function useSeekerReviews(client: InkoraClient, authorId: string) {
  return useQuery({ queryKey: ["seeker-reviews", authorId], queryFn: () => getSeekerReviews(client, authorId), enabled: !!authorId });
}
