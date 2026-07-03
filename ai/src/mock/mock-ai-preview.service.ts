import type { AiPreview, AiPreviewId, AiPreviewInput, ProfileId } from "@inkora/domain";

import type { AiPreviewService } from "../interfaces";

/**
 * MockAiPreviewService — PLACEHOLDER. NO inference of any kind.
 *
 * It fabricates an AiPreview that stays `queued` forever (resultImagePath = null)
 * so the UI can render the "AI preview coming soon" placeholder state without a
 * backend. The real service later implements the SAME `AiPreviewService`
 * interface (e.g. an Edge Function that enqueues a job) — callers don't change.
 *
 * TODO(ai): replace with the real generation pipeline. Do NOT add Stable
 * Diffusion / Flux / ComfyUI / ControlNet / OpenCV / segmentation / body
 * detection / GPU calls here — that lives behind the server boundary.
 */
export const MockAiPreviewService: AiPreviewService = {
  async create(input: AiPreviewInput): Promise<AiPreview> {
    return {
      id: `mock-${input.placement ?? "preview"}` as AiPreviewId,
      profileId: "mock" as ProfileId,
      sourceImagePath: input.sourceImagePath ?? null,
      sourceIdeaId: input.sourceIdeaId ?? null,
      prompt: input.prompt ?? null,
      styleId: input.styleId ?? null,
      placement: input.placement ?? null,
      status: "queued", // never advances in the mock
      resultImagePath: null,
      createdAt: new Date(0).toISOString(),
    };
  },
  async get(_id: AiPreviewId): Promise<AiPreview | null> {
    // TODO(ai): poll the real job status. The mock never completes.
    return null;
  },
};

/**
 * Curated "example" previews for the gallery on the AI-preview home screen.
 * These are NOT generated — they reuse the public style imagery so the UX has
 * something to show. `imagePath` points at the existing `styles/*` assets.
 */
export interface AiPreviewExample {
  id: string;
  label: string;
  styleSlug: string;
  imagePath: string;
}
export const MOCK_PREVIEW_EXAMPLES: AiPreviewExample[] = [
  { id: "ex-fineline", label: "Fine-line botanical", styleSlug: "fineline", imagePath: "styles/fineline.jpg" },
  { id: "ex-blackwork", label: "Bold blackwork", styleSlug: "blackwork", imagePath: "styles/blackwork.jpg" },
  { id: "ex-realism", label: "Black & grey realism", styleSlug: "realism", imagePath: "styles/realism.jpg" },
  { id: "ex-japanese", label: "Neo-Japanese", styleSlug: "japanese", imagePath: "styles/japanese.jpg" },
  { id: "ex-geometric", label: "Geometric", styleSlug: "geometric", imagePath: "styles/geometric.jpg" },
  { id: "ex-watercolor", label: "Watercolor", styleSlug: "watercolor", imagePath: "styles/watercolor.jpg" },
];
