import type {
  AiPreview, AiPreviewId, AiPreviewInput, AiPreviewStatus, ArtistId, IdeaId, Page, PortfolioImageId,
  ProfileId, StyleId, TattooTryOnInput,
} from "@inkora/domain";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

// NOTE: PLACEHOLDER feature. This module only PERSISTS preview requests + serves
// the source photo. It performs NO image generation. Rows are created with
// status 'queued' and result_image_path stays null until a real AI service
// (behind @inkora/ai's AiPreviewService) fills them in.
const BUCKET = "ai-previews"; // private bucket → signed URLs

const COLS = "id, profile_id, source_image_path, source_idea_id, source_flash_id, prompt, style_id, placement, status, result_image_path, created_at";

interface PreviewRow {
  id: string;
  profile_id: string;
  source_image_path: string | null;
  source_idea_id: string | null;
  source_flash_id: string | null;
  prompt: string | null;
  style_id: string | null;
  placement: string | null;
  status: string;
  result_image_path: string | null;
  created_at: string;
}
function mapPreview(r: PreviewRow): AiPreview {
  return {
    id: r.id as AiPreviewId,
    profileId: r.profile_id as ProfileId,
    sourceImagePath: r.source_image_path,
    sourceIdeaId: (r.source_idea_id as IdeaId | null) ?? null,
    sourceFlashId: (r.source_flash_id as PortfolioImageId | null) ?? null,
    prompt: r.prompt,
    styleId: (r.style_id as StyleId | null) ?? null,
    placement: r.placement,
    status: r.status as AiPreviewStatus,
    resultImagePath: r.result_image_path,
    createdAt: r.created_at,
  };
}

async function meId(client: InkoraClient): Promise<string> {
  const { data } = await client.auth.getUser();
  const id = data.user?.id;
  if (!id) throw toAppError({ message: "unauthenticated" });
  return id;
}

/** Upload the user's body photo to the private ai-previews bucket. Returns the object path. */
export async function uploadPreviewSource(client: InkoraClient, body: ArrayBuffer | Blob, contentType: string, ext: string): Promise<string> {
  const uid = await meId(client);
  const path = `${uid}/${Date.now()}.${ext}`; // folder must be the uid (RLS)
  const { error } = await client.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw toAppError(error);
  return path;
}

export async function getPreviewSignedUrl(client: InkoraClient, path: string, ttlSeconds = 3600): Promise<string | null> {
  const { data } = await client.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}

/** Upload a finished try-on composite (PNG) to the private ai-previews bucket. */
export async function uploadTryOnResult(
  client: InkoraClient,
  bytes: ArrayBuffer | Blob | Uint8Array,
  ext = "png",
  contentType = "image/png",
): Promise<string> {
  const uid = await meId(client);
  const path = `${uid}/tryon-${Date.now()}.${ext}`; // folder must be the uid (RLS)
  const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw toAppError(error);
  return path;
}

/** Persist a finished on-device try-on as a completed preview (no body photo stored). */
export async function saveTattooTryOn(client: InkoraClient, input: TattooTryOnInput): Promise<AiPreview> {
  const me = await meId(client);
  const { data, error } = await client
    .from("ai_previews")
    .insert({
      profile_id: me,
      source_image_path: null, // privacy: the raw body photo is never uploaded
      source_flash_id: input.sourceFlashId ?? null,
      prompt: input.note ?? null,
      placement: input.placement ?? null,
      status: "completed",
      result_image_path: input.resultImagePath,
    })
    .select(COLS)
    .single<PreviewRow>();
  if (error) throw toAppError(error);
  return mapPreview(data);
}

/** A flash design in the try-on picker (with its artist, for the booking CTA). */
export interface FlashListItem {
  id: PortfolioImageId;
  imagePath: string;
  caption: string | null;
  artistId: ArtistId;
  artistName: string;
  artistAvatarPath: string | null;
}
interface FlashRow {
  id: string;
  image_path: string;
  caption: string | null;
  artist_id: string;
  created_at: string;
  artists: { profiles: { display_name: string; avatar_path: string | null } | null } | null;
}
function mapFlashRow(r: FlashRow): FlashListItem {
  return {
    id: r.id as PortfolioImageId,
    imagePath: r.image_path,
    caption: r.caption,
    artistId: r.artist_id as ArtistId,
    artistName: r.artists?.profiles?.display_name ?? "Artist",
    artistAvatarPath: r.artists?.profiles?.avatar_path ?? null,
  };
}
/** Recent flash designs across artists — the catalog for "try one on". */
export async function listFlashes(client: InkoraClient, limit = 40): Promise<FlashListItem[]> {
  const { data, error } = await client
    .from("portfolio_images")
    .select("id, image_path, caption, artist_id, created_at, artists!inner(profiles!inner(display_name, avatar_path))")
    .eq("kind", "flash")
    .neq("moderation_status", "rejected")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<FlashRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(mapFlashRow);
}

/** One page of the flash browse feed — keyset-paginated by created_at (newest
 *  first), so the flashes grid can scroll infinitely like the idea feed. */
export async function fetchFlashFeedPage(client: InkoraClient, cursor: string | undefined, limit = 18): Promise<Page<FlashListItem>> {
  let q = client
    .from("portfolio_images")
    .select("id, image_path, caption, artist_id, created_at, artists!inner(profiles!inner(display_name, avatar_path))")
    .eq("kind", "flash")
    .neq("moderation_status", "rejected")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("created_at", cursor);
  const { data, error } = await q.returns<FlashRow[]>();
  if (error) throw toAppError(error);
  const rows = data ?? [];
  const items = rows.map(mapFlashRow);
  const hasMore = rows.length === limit;
  const nextCursor = hasMore ? rows[rows.length - 1]!.created_at : null;
  return { items, nextCursor, hasMore };
}

/**
 * Create a preview request. Inserts a row with status 'queued'; NO generation.
 * TODO(ai): after insert, enqueue the job via the AiPreviewService boundary
 * (e.g. a `generate-ai-preview` Edge Function). The worker flips status →
 * 'processing' → 'completed' and sets result_image_path. Nothing here runs a model.
 */
export async function createAiPreview(client: InkoraClient, input: AiPreviewInput): Promise<AiPreview> {
  const me = await meId(client);
  const { data, error } = await client
    .from("ai_previews")
    .insert({
      profile_id: me,
      source_image_path: input.sourceImagePath ?? null,
      source_idea_id: input.sourceIdeaId ?? null,
      prompt: input.prompt ?? null,
      style_id: input.styleId ?? null,
      placement: input.placement ?? null,
      status: "queued",
    })
    .select(COLS)
    .single<PreviewRow>();
  if (error) throw toAppError(error);
  return mapPreview(data);
}

export async function listAiPreviews(client: InkoraClient): Promise<AiPreview[]> {
  const { data, error } = await client.from("ai_previews").select(COLS).order("created_at", { ascending: false }).limit(50).returns<PreviewRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map(mapPreview);
}

export async function getAiPreview(client: InkoraClient, id: string): Promise<AiPreview | null> {
  const { data, error } = await client.from("ai_previews").select(COLS).eq("id", id).maybeSingle<PreviewRow>();
  if (error) throw toAppError(error);
  return data ? mapPreview(data) : null;
}

/** Delete a saved try-on: remove its composite file (best-effort) then the row. */
export async function deleteAiPreview(client: InkoraClient, id: string, resultImagePath?: string | null): Promise<void> {
  if (resultImagePath) {
    await client.storage.from(BUCKET).remove([resultImagePath]); // best-effort; ignore storage errors
  }
  const { error } = await client.from("ai_previews").delete().eq("id", id);
  if (error) throw toAppError(error);
}

export const aiKeys = {
  list: ["ai-previews"] as const,
  one: (id: string) => ["ai-preview", id] as const,
  flashes: ["ai-flashes"] as const,
};
export function useAiPreviews(client: InkoraClient) {
  return useQuery({ queryKey: aiKeys.list, queryFn: () => listAiPreviews(client) });
}
export function useAiPreview(client: InkoraClient, id: string) {
  return useQuery({ queryKey: aiKeys.one(id), queryFn: () => getAiPreview(client, id), enabled: !!id });
}
export function useFlashes(client: InkoraClient) {
  return useQuery({ queryKey: aiKeys.flashes, queryFn: () => listFlashes(client) });
}

/** Infinite flash browse feed (newest first) for the Explore/Discover Flashes toggle. */
export function useFlashFeed(client: InkoraClient, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["flash-feed"],
    queryFn: ({ pageParam }: { pageParam?: string }) => fetchFlashFeedPage(client, pageParam),
    enabled,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<FlashListItem>) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}
