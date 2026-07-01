import type { AiPreview, AiPreviewInput } from "@inkora/domain";

/**
 * EXAMPLE hook stub — NOT implemented. AI is a PLACEHOLDER.
 * Delegates to the mocked AiPreviewService in the `ai/` package. No inference.
 */
export interface UseAiPreviewResult {
  preview: AiPreview | null;
  isGenerating: boolean;
  generate: (input: AiPreviewInput) => void; // returns a mocked, never-completing preview
}

// TODO: export function useAiPreview(): UseAiPreviewResult  (wraps @inkora/ai mock)
export {};
