import type { ArtistId, IdeaId, JourneyEntry, JourneyEntryId, ProfileId } from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import type { Json } from "../db/database.types";
import { toAppError } from "../errors";

// ------------------------------------------------------------------ profile summary
export interface ProfileSummary {
  displayName: string;
  username: string | null;
  avatarPath: string | null;
  city: string | null;
  bio: string | null;
  memberSince: string; // ISO
}
export async function getProfileSummary(client: InkoraClient): Promise<ProfileSummary | null> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  if (!me) return null;
  const { data, error } = await client
    .from("profiles")
    .select("display_name, username, avatar_path, city, bio, created_at")
    .eq("id", me)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    displayName: data.display_name,
    username: data.username,
    avatarPath: data.avatar_path,
    city: data.city,
    bio: data.bio,
    memberSince: data.created_at,
  };
}

/** Patch the caller's profile (RLS restricts to their own row). */
export async function updateMyProfile(
  client: InkoraClient,
  fields: { displayName?: string; username?: string | null; city?: string | null; bio?: string | null; avatarPath?: string | null; searchRadiusKm?: number },
): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  if (!me) throw toAppError({ message: "unauthenticated" });
  const patch: Record<string, unknown> = {};
  if (fields.displayName !== undefined) patch.display_name = fields.displayName.trim();
  if (fields.username !== undefined) patch.username = fields.username?.trim() || null;
  if (fields.city !== undefined) patch.city = fields.city?.trim() || null;
  if (fields.bio !== undefined) patch.bio = fields.bio?.trim() || null;
  if (fields.avatarPath !== undefined) patch.avatar_path = fields.avatarPath;
  if (fields.searchRadiusKm !== undefined) patch.search_radius_km = Math.min(500, Math.max(1, Math.round(fields.searchRadiusKm)));
  const { error } = await client.from("profiles").update(patch).eq("id", me);
  if (error) throw toAppError(error);
}

/** Upload a new avatar to the public `avatars` bucket; returns the bucket-qualified path. */
export async function uploadAvatar(client: InkoraClient, body: ArrayBuffer | Blob, contentType: string, ext: string): Promise<string> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError({ message: "unauthenticated" });
  const objectPath = `${uid}/${Date.now()}.${ext}`; // folder must be the uid (RLS)
  const { error } = await client.storage.from("avatars").upload(objectPath, body, { contentType, upsert: false });
  if (error) throw toAppError(error);
  return `avatars/${objectPath}`;
}

// ------------------------------------------------------------------ account settings
export interface AccountSettings {
  searchRadiusKm: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
}
export async function getAccountSettings(client: InkoraClient): Promise<AccountSettings> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  if (!me) throw toAppError({ message: "unauthenticated" });
  const { data: prof } = await client.from("profiles").select("search_radius_km").eq("id", me).maybeSingle();
  const { data: prefs } = await client.from("notification_preferences").select("channels").eq("profile_id", me).maybeSingle();
  const channels = (prefs?.channels ?? {}) as Record<string, unknown>;
  return {
    searchRadiusKm: prof?.search_radius_km ?? 25,
    pushEnabled: channels["push"] !== false,
    emailEnabled: channels["email"] !== false,
  };
}

export async function setNotificationPrefs(client: InkoraClient, patch: { push?: boolean; email?: boolean }): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  if (!me) throw toAppError({ message: "unauthenticated" });
  const { data } = await client.from("notification_preferences").select("channels").eq("profile_id", me).maybeSingle();
  const channels = { ...((data?.channels as Record<string, unknown>) ?? {}), ...patch };
  const { error } = await client
    .from("notification_preferences")
    .upsert({ profile_id: me, channels: channels as unknown as Json }, { onConflict: "profile_id" });
  if (error) throw toAppError(error);
}

// ------------------------------------------------------------------ saved artists
export interface SavedArtistCard {
  id: ArtistId;
  displayName: string;
  avatarPath: string | null;
  headline: string | null;
  ratingAvg: number;
}
export async function getSavedArtists(client: InkoraClient): Promise<SavedArtistCard[]> {
  const { data: favs, error: favErr } = await client
    .from("favorites")
    .select("target_id, created_at")
    .eq("target_type", "artist")
    .order("created_at", { ascending: false });
  if (favErr) throw toAppError(favErr);
  const ids = (favs ?? []).map((f) => f.target_id);
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("artists")
    .select("id, headline, rating_avg, profiles!inner(display_name, avatar_path)")
    .in("id", ids)
    .returns<{ id: string; headline: string | null; rating_avg: number; profiles: { display_name: string; avatar_path: string | null } | null }[]>();
  if (error) throw toAppError(error);
  const order = new Map(ids.map((id, i) => [id, i]));
  return (data ?? [])
    .map((a) => ({
      id: a.id as ArtistId,
      displayName: a.profiles?.display_name ?? "Artist",
      avatarPath: a.profiles?.avatar_path ?? null,
      headline: a.headline,
      ratingAvg: Number(a.rating_avg),
    }))
    .sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
}

// ------------------------------------------------------------------ saved designs (saved ideas)
export interface SavedDesignCard {
  id: IdeaId;
  title: string | null;
  imagePath: string;
}
export async function getSavedDesigns(client: InkoraClient): Promise<SavedDesignCard[]> {
  const { data: favs, error: favErr } = await client
    .from("favorites")
    .select("target_id, created_at")
    .eq("target_type", "idea")
    .order("created_at", { ascending: false });
  if (favErr) throw toAppError(favErr);
  const ids = (favs ?? []).map((f) => f.target_id);
  if (ids.length === 0) return [];
  const { data, error } = await client.from("tattoo_ideas").select("id, title, image_path").in("id", ids);
  if (error) throw toAppError(error);
  const order = new Map(ids.map((id, i) => [id, i]));
  return (data ?? [])
    .map((d) => ({ id: d.id as IdeaId, title: d.title, imagePath: d.image_path }))
    .sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
}

// ------------------------------------------------------------------ journey
export async function getJourney(client: InkoraClient): Promise<JourneyEntry[]> {
  const { data, error } = await client
    .from("tattoo_journey_entries")
    .select("id, profile_id, appointment_id, artist_id, idea_id, entry_type, title, notes, image_paths, occurred_on")
    .order("occurred_on", { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id as JourneyEntryId,
    profileId: r.profile_id as ProfileId,
    appointmentId: (r.appointment_id as JourneyEntry["appointmentId"]) ?? null,
    artistId: (r.artist_id as ArtistId | null) ?? null,
    ideaId: (r.idea_id as IdeaId | null) ?? null,
    entryType: r.entry_type as JourneyEntry["entryType"],
    title: r.title,
    notes: r.notes,
    imagePaths: r.image_paths ?? [],
    occurredOn: r.occurred_on,
  }));
}

// ------------------------------------------------------------------ hooks
export const dashboardKeys = {
  profile: ["profile-summary"] as const,
  savedArtists: ["saved-artists"] as const,
  savedDesigns: ["saved-designs"] as const,
  journey: ["journey"] as const,
  accountSettings: ["account-settings"] as const,
};
export function useAccountSettings(client: InkoraClient) {
  return useQuery({ queryKey: dashboardKeys.accountSettings, queryFn: () => getAccountSettings(client) });
}
export function useProfileSummary(client: InkoraClient) {
  return useQuery({ queryKey: dashboardKeys.profile, queryFn: () => getProfileSummary(client) });
}
export function useSavedArtists(client: InkoraClient) {
  return useQuery({ queryKey: dashboardKeys.savedArtists, queryFn: () => getSavedArtists(client) });
}
export function useSavedDesigns(client: InkoraClient) {
  return useQuery({ queryKey: dashboardKeys.savedDesigns, queryFn: () => getSavedDesigns(client) });
}
export function useJourney(client: InkoraClient) {
  return useQuery({ queryKey: dashboardKeys.journey, queryFn: () => getJourney(client) });
}
