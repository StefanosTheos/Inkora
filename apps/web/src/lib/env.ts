// Typed env for web. NEXT_PUBLIC_* are client-safe; service role key is server-only.
// TODO: validate with zod (separate client/server schemas).
export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Hide the Apple sign-in button until the Apple provider is configured. */
  APPLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true",
};
