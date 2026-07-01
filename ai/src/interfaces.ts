import type { AiPreview, AiPreviewInput, AiPreviewId } from "@inkora/domain";

/**
 * The AI preview service boundary. The MVP ships a mock implementation.
 * A real model later implements THIS SAME interface — callers never change.
 */
export interface AiPreviewService {
  /** Create a preview request. In the mock this returns status 'queued' and never completes. */
  create(input: AiPreviewInput): Promise<AiPreview>;
  /** Poll a preview. Mock always returns the same non-completing preview. */
  get(id: AiPreviewId): Promise<AiPreview | null>;
}
