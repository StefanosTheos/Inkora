/**
 * Curated "example" previews for the gallery on the AI-preview screens.
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
