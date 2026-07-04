// Typed env access for mobile (EXPO_PUBLIC_* only — never service keys on device).
// TODO: validate with zod at startup; surface from app.config extra / process.env.
export const env = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  /** Hide the Apple sign-in button until the Apple provider is configured. */
  APPLE_AUTH_ENABLED: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === "true",
  /** Serve resized image variants (needs the Supabase Image Transformation add-on). Off = originals. */
  IMAGE_TRANSFORM_ENABLED: process.env.EXPO_PUBLIC_IMAGE_TRANSFORM === "true",
};
