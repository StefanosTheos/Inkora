import type { ArtistId, IdeaCard, IdeaDetail, IdeaId } from "@inkora/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

const CARD_COLS =
  "id, title, image_path, width, height, save_count, source_artist_id, idea_styles(tattoo_styles(slug))";

interface CardRow {
  id: string;
  title: string | null;
  image_path: string;
  width: number | null;
  height: number | null;
  save_count: number;
  source_artist_id: string | null;
  idea_styles: { tattoo_styles: { slug: string } | null }[] | null;
}
function mapCard(r: CardRow): IdeaCard {
  return {
    id: r.id as IdeaId,
    title: r.title,
    imagePath: r.image_path,
    width: r.width,
    height: r.height,
    saveCount: r.save_count,
    sourceArtistId: (r.source_artist_id as ArtistId | null) ?? null,
    styleSlugs: (r.idea_styles ?? []).map((s) => s.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
  };
}

// ------------------------------------------------------------------ detail
interface DetailRow {
  id: string;
  title: string | null;
  description: string | null;
  image_path: string;
  width: number | null;
  height: number | null;
  save_count: number;
  idea_styles: { tattoo_styles: { slug: string } | null }[] | null;
  artist: {
    id: string;
    headline: string | null;
    is_accepting: boolean;
    profiles: { display_name: string; avatar_path: string | null } | null;
  } | null;
}

export async function getIdeaDetail(client: InkoraClient, id: string): Promise<IdeaDetail | null> {
  const { data, error } = await client
    .from("tattoo_ideas")
    .select(
      "id, title, description, image_path, width, height, save_count, idea_styles(tattoo_styles(slug)), " +
        "artist:artists!tattoo_ideas_source_artist_id_fkey(id, headline, is_accepting, profiles(display_name, avatar_path))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<DetailRow>();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    id: data.id as IdeaId,
    title: data.title,
    description: data.description,
    imagePath: data.image_path,
    width: data.width,
    height: data.height,
    saveCount: data.save_count,
    styleSlugs: (data.idea_styles ?? []).map((s) => s.tattoo_styles?.slug).filter((x): x is string => Boolean(x)),
    artist: data.artist
      ? {
          id: data.artist.id as ArtistId,
          displayName: data.artist.profiles?.display_name ?? "Artist",
          avatarPath: data.artist.profiles?.avatar_path ?? null,
          headline: data.artist.headline,
          isAccepting: data.artist.is_accepting,
        }
      : null,
  };
}

/** Ideas sharing at least one style with this one (ranked loosely by popularity). */
export async function getSimilarIdeas(client: InkoraClient, ideaId: string, limit = 12): Promise<IdeaCard[]> {
  const { data: styleRows, error: sErr } = await client.from("idea_styles").select("style_id").eq("idea_id", ideaId);
  if (sErr) throw toAppError(sErr);
  const styleIds = (styleRows ?? []).map((r) => r.style_id);
  if (styleIds.length === 0) return [];

  const { data: candRows, error: cErr } = await client
    .from("idea_styles")
    .select("idea_id")
    .in("style_id", styleIds)
    .neq("idea_id", ideaId)
    .limit(120);
  if (cErr) throw toAppError(cErr);
  const ids = [...new Set((candRows ?? []).map((r) => r.idea_id))].slice(0, 40);
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from("tattoo_ideas")
    .select(CARD_COLS)
    .in("id", ids)
    .eq("is_public", true)
    .eq("moderation_status", "approved")
    .is("deleted_at", null)
    .order("save_count", { ascending: false })
    .limit(limit)
    .returns<CardRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(mapCard);
}

// ------------------------------------------------------------------ save (favorite an idea)
export async function isIdeaSaved(client: InkoraClient, ideaId: string): Promise<boolean> {
  const { data, error } = await client
    .from("favorites")
    .select("id")
    .eq("target_type", "idea")
    .eq("target_id", ideaId)
    .maybeSingle<{ id: string }>();
  if (error) throw toAppError(error);
  return data != null;
}

export async function setIdeaSaved(client: InkoraClient, ideaId: string, saved: boolean): Promise<void> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw toAppError(new Error("You need to sign in to save designs."));
  if (saved) {
    const { error } = await client
      .from("favorites")
      .upsert(
        { profile_id: uid, target_type: "idea", target_id: ideaId },
        { onConflict: "profile_id,target_type,target_id", ignoreDuplicates: true },
      );
    if (error) throw toAppError(error);
  } else {
    const { error } = await client
      .from("favorites")
      .delete()
      .eq("profile_id", uid)
      .eq("target_type", "idea")
      .eq("target_id", ideaId);
    if (error) throw toAppError(error);
  }
}

// ------------------------------------------------------------------ hooks
export function useIdeaDetail(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["idea", id], queryFn: () => getIdeaDetail(client, id), enabled: !!id });
}
export function useSimilarIdeas(client: InkoraClient, id: string) {
  return useQuery({ queryKey: ["idea-similar", id], queryFn: () => getSimilarIdeas(client, id), enabled: !!id });
}

/** Saved state + optimistic toggle for one design. Refreshes the dashboard's
 *  Saved designs list. Saving is pure curation — it does not award points. */
export function useIdeaSaved(client: InkoraClient, ideaId: string) {
  const qc = useQueryClient();
  const key = ["idea-saved", ideaId] as const;
  const q = useQuery({ queryKey: key, queryFn: () => isIdeaSaved(client, ideaId), enabled: !!ideaId });
  const saved = q.data ?? false;
  const mutation = useMutation({
    mutationFn: (next: boolean) => setIdeaSaved(client, ideaId, next),
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
      void qc.invalidateQueries({ queryKey: ["saved-designs"] }); // dashboardKeys.savedDesigns
      void qc.invalidateQueries({ queryKey: ["saved-count"] }); // dashboardKeys.savedCount
    },
  });
  return { saved, isLoading: q.isLoading, isToggling: mutation.isPending, toggle: () => mutation.mutate(!saved) };
}
