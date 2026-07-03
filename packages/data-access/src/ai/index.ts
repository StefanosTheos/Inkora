import type { AiPreview, AiPreviewId, AiPreviewInput, AiPreviewStatus, IdeaId, ProfileId, StyleId } from "@inkora/domain";
import { useQuery } from "@tanstack/react-query";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

// NOTE: PLACEHOLDER feature. This module only PERSISTS preview requests + serves
// the source photo. It performs NO image generation. Rows are created with
// status 'queued' and result_image_path stays null until a real AI service
// (behind @inkora/ai's AiPreviewService) fills them in.
const BUCKET = "ai-previews"; // private bucket → signed URLs

const COLS = "id, profile_id, source_image_path, source_idea_id, prompt, style_id, placement, status, result_image_path, created_at";

interface PreviewRow {
  id: string;
  profile_id: string;
  source_image_path: string | null;
  source_idea_id: string | null;
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
    prompt: r.prompt,
    styleId: (r.style_id as StyleId | null) ?? null,
    placement: r.placement,
    status: r.status as AiPreviewStatus,
    resultImagePath: r.result_image_path, // always null in the MVP
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

export const aiKeys = {
  list: ["ai-previews"] as const,
  one: (id: string) => ["ai-preview", id] as const,
};
export function useAiPreviews(client: InkoraClient) {
  return useQuery({ queryKey: aiKeys.list, queryFn: () => listAiPreviews(client) });
}
export function useAiPreview(client: InkoraClient, id: string) {
  return useQuery({ queryKey: aiKeys.one(id), queryFn: () => getAiPreview(client, id), enabled: !!id });
}
