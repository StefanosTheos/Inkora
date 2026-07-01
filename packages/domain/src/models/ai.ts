import type { AiPreviewId, IdeaId, ProfileId, StyleId } from "../ids";
import type { AiPreviewStatus } from "../enums";

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
