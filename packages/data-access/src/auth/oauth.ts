import type { Result } from "@inkora/domain";
import type { InkoraClient } from "../client/types";

/**
 * Platform-specific OAuth strategy. The shared AuthProvider calls these; each app
 * injects its own implementation:
 *   - web    → supabase.auth.signInWithOAuth({ redirectTo }) (full-page redirect)
 *   - mobile → expo WebBrowser PKCE flow + deep link, Apple via native AppleAuthentication
 *
 * Email/password & signOut are identical across platforms and live in the provider.
 */
export interface OAuthAdapter {
  signInWithGoogle(client: InkoraClient): Promise<Result<void>>;
  signInWithApple(client: InkoraClient): Promise<Result<void>>;
}

/** Default no-op adapter (used if an app forgets to inject one — fails loudly in dev). */
export const unsupportedOAuth: OAuthAdapter = {
  async signInWithGoogle() {
    return { ok: false, error: { code: "internal", message: "Google sign-in not configured", retriable: false } };
  },
  async signInWithApple() {
    return { ok: false, error: { code: "internal", message: "Apple sign-in not configured", retriable: false } };
  },
};
