import type { InkoraClient } from "@inkora/data-access";
import { type OAuthAdapter, toAppError } from "@inkora/data-access";
import type { Result } from "@inkora/domain";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

// inkora://auth/callback — must match app.config.ts scheme + Supabase redirect allow-list.
const redirectTo = Linking.createURL("/auth/callback");

const cancelled: Result<void> = {
  ok: false,
  error: { code: "validation", message: "Sign-in cancelled.", retriable: true },
};

/** Browser-based PKCE flow (Google always; Apple on Android). */
async function webFlow(client: InkoraClient, provider: "google" | "apple"): Promise<Result<void>> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { ok: false, error: toAppError(error ?? new Error("no auth url")) };

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success") return cancelled;

  const { queryParams } = Linking.parse(res.url);
  const code = queryParams?.code;
  if (typeof code !== "string") return { ok: false, error: { code: "internal", message: "Missing auth code", retriable: true } };

  const { error: exErr } = await client.auth.exchangeCodeForSession(code);
  return exErr ? { ok: false, error: toAppError(exErr) } : { ok: true, value: undefined };
}

export const mobileOAuth: OAuthAdapter = {
  signInWithGoogle: (client) => webFlow(client, "google"),

  async signInWithApple(client) {
    // Native Apple sign-in on iOS (required by App Store); web flow elsewhere.
    if (Platform.OS !== "ios") return webFlow(client, "apple");
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) return { ok: false, error: { code: "internal", message: "No Apple identity token", retriable: true } };
      const { error } = await client.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken });
      return error ? { ok: false, error: toAppError(error) } : { ok: true, value: undefined };
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return cancelled;
      return { ok: false, error: toAppError(e) };
    }
  },
};
