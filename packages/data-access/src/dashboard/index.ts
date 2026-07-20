import type { ArtistId } from "@inkora/domain";
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
    // Push and email are both opt-in — off unless the user explicitly enabled
    // them (during the onboarding consent step, or later in settings). In-app
    // notifications stay always-on. Push additionally requires OS permission.
    pushEnabled: channels["push"] === true,
    emailEnabled: channels["email"] === true,
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
    .order("created_at", { ascending: false })
    .limit(60);
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

// ------------------------------------------------------------------ saved designs (saved ideas + portfolio pieces)
export interface SavedDesignCard {
  id: string;
  targetType: "idea" | "portfolio_image";
  title: string | null;
  imagePath: string;
  /** The artist the design belongs to (null for unattributed ideas) — used to
   *  show attribution and to start a booking with this design as a reference. */
  artistId: string | null;
  artistName: string | null;
  /** A flash piece (portfolio_image with kind='flash') — eligible for try-on. */
  isFlash: boolean;
}
export async function getSavedDesigns(client: InkoraClient): Promise<SavedDesignCard[]> {
  const { data: favs, error: favErr } = await client
    .from("favorites")
    .select("target_id, target_type, created_at")
    .in("target_type", ["idea", "portfolio_image"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (favErr) throw toAppError(favErr);
  const rows = favs ?? [];
  const ideaIds = rows.filter((f) => f.target_type === "idea").map((f) => f.target_id);
  const pieceIds = rows.filter((f) => f.target_type === "portfolio_image").map((f) => f.target_id);
  if (ideaIds.length === 0 && pieceIds.length === 0) return [];

  const cards = new Map<string, SavedDesignCard>();
  if (ideaIds.length > 0) {
    const { data, error } = await client.from("tattoo_ideas").select("id, title, image_path, source_artist_id").in("id", ideaIds);
    if (error) throw toAppError(error);
    for (const d of data ?? []) cards.set(d.id, { id: d.id, targetType: "idea", title: d.title, imagePath: d.image_path, artistId: d.source_artist_id ?? null, artistName: null, isFlash: false });
  }
  if (pieceIds.length > 0) {
    const { data, error } = await client.from("portfolio_images").select("id, caption, image_path, artist_id, kind").in("id", pieceIds);
    if (error) throw toAppError(error);
    for (const d of data ?? []) cards.set(d.id, { id: d.id, targetType: "portfolio_image", title: d.caption, imagePath: d.image_path, artistId: d.artist_id, artistName: null, isFlash: d.kind === "flash" });
  }

  // Resolve artist display names (artists.id === profiles.id).
  const artistIds = [...new Set([...cards.values()].map((c) => c.artistId).filter((id): id is string => !!id))];
  if (artistIds.length > 0) {
    const { data } = await client.from("profiles").select("id, display_name").in("id", artistIds);
    const names = new Map((data ?? []).map((p) => [p.id, p.display_name]));
    for (const c of cards.values()) if (c.artistId) c.artistName = names.get(c.artistId) ?? null;
  }

  // Preserve the favorites (created_at desc) order.
  const order = new Map(rows.map((f, i) => [f.target_id, i]));
  return [...cards.values()].sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
}

/** Remove a saved design (either an idea or a portfolio piece). */
export async function removeSavedDesign(client: InkoraClient, id: string, targetType: "idea" | "portfolio_image"): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError(new Error("You need to sign in."));
  const { error } = await client
    .from("favorites")
    .delete()
    .eq("profile_id", uid)
    .eq("target_type", targetType)
    .eq("target_id", id);
  if (error) throw toAppError(error);
}

// ------------------------------------------------------------------ hooks
export const dashboardKeys = {
  profile: ["profile-summary"] as const,
  savedArtists: ["saved-artists"] as const,
  savedDesigns: ["saved-designs"] as const,
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
