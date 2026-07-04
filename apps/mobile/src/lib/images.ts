import { type ImageTransform, publicStorageUrl } from "@inkora/data-access";

import { env } from "./env";

/**
 * Resolve a public-bucket path to a display URL, requesting a resized variant
 * when image transforms are enabled for the project (see env.IMAGE_TRANSFORM_ENABLED).
 * When disabled — or when no size is given — the original object URL is returned,
 * so this is safe on projects without the Supabase transformation add-on.
 *
 * `size` is the target *display* width in px; pass the rendered size and let the
 * @2x factor cover high-density screens.
 */
export function imageUrl(path?: string | null, size?: number): string | undefined {
  if (!path) return undefined;
  const transform: ImageTransform | undefined =
    env.IMAGE_TRANSFORM_ENABLED && size
      ? { width: size * 2, quality: 70, resize: "cover" }
      : undefined;
  return publicStorageUrl(env.SUPABASE_URL, path, transform);
}
