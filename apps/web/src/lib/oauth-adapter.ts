"use client";
import { type OAuthAdapter, toAppError } from "@inkora/data-access";
import type { Result } from "@inkora/domain";
import type { InkoraClient } from "@inkora/data-access";

/**
 * Web OAuth: full-page redirect to the provider, returning to /api/auth/callback
 * where the code is exchanged for a cookie session. Apple uses the same web flow.
 */
function makeRedirectTo(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/auth/callback`;
}

async function oauth(client: InkoraClient, provider: "google" | "apple"): Promise<Result<void>> {
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: makeRedirectTo() },
  });
  // On success the browser navigates away; an error means it didn't.
  return error ? { ok: false, error: toAppError(error) } : { ok: true, value: undefined };
}

export const webOAuth: OAuthAdapter = {
  signInWithGoogle: (client) => oauth(client, "google"),
  signInWithApple: (client) => oauth(client, "apple"),
};
