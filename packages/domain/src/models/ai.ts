import type { AiPreviewStatus } from "../enums";
import type { AiPreviewId, IdeaId, ProfileId, StyleId } from "../ids";

/**
 * AI tattoo-preview model. PLACEHOLDER ONLY in the MVP — captures the full input
 * contract so the real model later just fills `resultImagePath` and flips status.
 * No inference happens anywhere. See the `ai/` package for the mock service.
 */
export interface AiPreview {
  id: AiPreviewId;
  profileId: ProfileId;
  sourceImagePath: string | null;
  sourceIdeaId: IdeaId | null;
  prompt: string | null;
  styleId: StyleId | null;
  placement: string | null;
  status: AiPreviewStatus;
  resultImagePath: string | null;   // always null in MVP
  createdAt: string;
}

export interface AiPreviewInput {
  sourceImagePath?: string;
  sourceIdeaId?: IdeaId;
  prompt?: string;
  styleId?: StyleId;
  placement?: string;
}

// ---------------------------------------------------------------- placeholder UX helpers
export const AI_PREVIEW_STATUS_LABEL: Record<AiPreviewStatus, string> = {
  draft: "Draft",
  queued: "Preparing",
  processing: "Rendering",
  completed: "Ready",
  failed: "Failed",
};

/** Body areas offered in the AI-preview composer. */
export const AI_PLACEMENTS = ["Forearm", "Upper arm", "Hand", "Leg", "Calf", "Back", "Chest", "Ribs", "Neck", "Ankle"];

/** Shown wherever a result would appear — the MVP never generates an image. */
export const AI_PREVIEW_DISCLAIMER =
  "AI tattoo preview is coming soon. This is a placeholder — no image is generated yet.";

/** True while the preview has no result to show (always true in the MVP). */
export function isPreviewPending(p: Pick<AiPreview, "status" | "resultImagePath">): boolean {
  return p.resultImagePath == null && p.status !== "failed";
}
