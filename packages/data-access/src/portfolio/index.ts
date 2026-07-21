import type { ArtistId, PortfolioImageId } from "@inkora/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

// A portfolio piece rendered on the same detail page as an Explore idea.
export interface PortfolioDesignDetail {
  id: PortfolioImageId;
  imagePath: string;
  caption: string | null;
  placement: string | null;
  kind: "portfolio" | "flash";
  artist: {
    id: ArtistId;
    displayName: string;
    avatarPath: string | null;
    headline: string | null;
    isAccepting: boolean;
  } | null;
}

export interface PortfolioCard {
  id: PortfolioImageId;
  imagePath: string;
  caption: string | null;
}

interface DetailRow {
  id: string;
  image_path: string;
  caption: string | null;
  placement: string | null;
  kind: string;
  artists: {
    id: string;
    headline: string | null;
    is_accepting: boolean;
    profiles: { display_name: string; avatar_path: string | null } | null;
  } | null;
}

export async function getPortfolioDesign(client: InkoraClient, id: string): Promise<PortfolioDesignDetail | null> {
  const { data, error } = await client
    .from("portfolio_images")
    .select("id, image_path, caption, placement, kind, artists(id, headline, is_accepting, profiles(display_name, avatar_path))")
    .eq("id", id)
    .neq("moderation_status", "rejected")
    .maybeSingle<DetailRow>();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    id: data.id as PortfolioImageId,
    imagePath: data.image_path,
    caption: data.caption,
    placement: data.placement,
    kind: data.kind === "flash" ? "flash" : "portfolio",
    artist: data.artists
      ? {
          id: data.artists.id as ArtistId,
          displayName: data.artists.profiles?.display_name ?? "Artist",
          avatarPath: data.artists.profiles?.avatar_path ?? null,
          headline: data.artists.headline,
          isAccepting: data.artists.is_accepting,
        }
      : null,
  };
}

/** Other portfolio pieces by the same artist (the "similar" rail). */
export async function getMoreFromArtist(client: InkoraClient, artistId: string, excludeId: string, limit = 12): Promise<PortfolioCard[]> {
  if (!artistId) return [];
  const { data, error } = await client
    .from("portfolio_images")
    .select("id, image_path, caption")
    .eq("artist_id", artistId)
    .neq("id", excludeId)
    .neq("moderation_status", "rejected")
    .order("sort_order", { ascending: true })
    .limit(limit)
    .returns<{ id: string; image_path: string; caption: string | null }[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({ id: r.id as PortfolioImageId, imagePath: r.image_path, caption: r.caption }));
}

// ------------------------------------------------------------------ save (favorite a portfolio image)
export async function isPortfolioSaved(client: InkoraClient, imageId: string): Promise<boolean> {
  const { data, error } = await client
    .from("favorites")
    .select("id")
    .eq("target_type", "portfolio_image")
    .eq("target_id", imageId)
    .maybeSingle<{ id: string }>();
  if (error) throw toAppError(error);
  return data != null;
}

export async function setPortfolioSaved(client: InkoraClient, imageId: string, saved: boolean): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError(new Error("You need to sign in to save designs."));
  if (saved) {
    const { error } = await client
      .from("favorites")
      .upsert(
        { profile_id: uid, target_type: "portfolio_image", target_id: imageId },
        { onConflict: "profile_id,target_type,target_id", ignoreDuplicates: true },
      );
    if (error) throw toAppError(error);
  } else {
    const { error } = await client
      .from("favorites")
      .delete()
      .eq("profile_id", uid)
      .eq("target_type", "portfolio_image")
      .eq("target_id", imageId);
    if (error) throw toAppError(error);
  }
}

// ------------------------------------------------------------------ hooks
export function usePortfolioDesign(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["portfolio-design", id], queryFn: () => getPortfolioDesign(client, id), enabled: !!id });
}
export function useMoreFromArtist(client: InkoraClient, artistId: string, excludeId: string) {
  return useQuery({
    queryKey: ["portfolio-more", artistId, excludeId],
    queryFn: () => getMoreFromArtist(client, artistId, excludeId),
    enabled: !!artistId,
  });
}

/** Saved state + optimistic toggle for a portfolio piece. Mirrors useIdeaSaved
 *  and refreshes the profile's Saved designs list. */
export function usePortfolioSaved(client: InkoraClient, imageId: string) {
  const qc = useQueryClient();
  const key = ["portfolio-saved", imageId] as const;
  const q = useQuery({ queryKey: key, queryFn: () => isPortfolioSaved(client, imageId), enabled: !!imageId });
  const saved = q.data ?? false;
  const mutation = useMutation({
    mutationFn: (next: boolean) => setPortfolioSaved(client, imageId, next),
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
      void qc.invalidateQueries({ queryKey: ["saved-designs"] });
      void qc.invalidateQueries({ queryKey: ["saved-count"] }); // dashboardKeys.savedCount
    },
  });
  return { saved, isLoading: q.isLoading, isToggling: mutation.isPending, toggle: () => mutation.mutate(!saved) };
}
