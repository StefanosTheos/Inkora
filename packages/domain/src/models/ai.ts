import type { AiPreviewStatus } from "../enums";
import type { AiPreviewId, PortfolioImageId, ProfileId, StyleId } from "../ids";

/**
 * AI tattoo-preview model. The MVP implements the "try-on" flow: a flash design
 * is composited onto the user's body photo ON-DEVICE and the resulting mockup is
 * saved here (status 'completed', resultImagePath set, sourceFlashId recorded).
 * `sourceImagePath` (the raw body photo) is intentionally NOT stored for try-ons
 * — only the composite the user chooses to keep.
 */
export interface AiPreview {
  id: AiPreviewId;
  profileId: ProfileId;
  sourceImagePath: string | null;
  sourceFlashId: PortfolioImageId | null;
  prompt: string | null;
  styleId: StyleId | null;
  placement: string | null;
  status: AiPreviewStatus;
  resultImagePath: string | null;
  createdAt: string;
}

/** Persisting a finished on-device try-on composite. */
export interface TattooTryOnInput {
  /** Storage path of the already-uploaded composite mockup. */
  resultImagePath: string;
  /** The flash the design came from (enables "Book this design"). */
  sourceFlashId?: PortfolioImageId;
  placement?: string;
  /** Short label kept with the try-on (e.g. the flash caption / artist name). */
  note?: string;
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

/** Shown with every try-on so expectations are set honestly. */
export const AI_PREVIEW_DISCLAIMER =
  "This is a visual mockup to help you picture the design on you. The real tattoo's look depends on your artist, skin and placement.";

/** True while the preview has no result to show. */
export function isPreviewPending(p: Pick<AiPreview, "status" | "resultImagePath">): boolean {
  return p.resultImagePath == null && p.status !== "failed";
}
