import type { AiPreviewService } from "../interfaces";

/**
 * MockAiPreviewService — PLACEHOLDER. No inference.
 * Intended behavior (TODO: implement as a trivial mock, NOT real AI):
 *   - create(input): returns an AiPreview with status 'queued', resultImagePath = null
 *   - get(id):       returns the same preview, never transitions to 'completed'
 * The UI uses this to render the "AI preview coming soon" placeholder state.
 */
export declare const MockAiPreviewService: AiPreviewService;

// TODO: provide the trivial mock object. Do NOT add ML/inference.
