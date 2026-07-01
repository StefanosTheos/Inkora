import type { AuthContext as DomainAuthContext, ProfileId } from "@inkora/domain";
import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";
import { rolesFromAccessToken } from "./jwt";
import { type OAuthAdapter, unsupportedOAuth } from "./oauth";
import type { AuthContextValue, AuthState, SignUpParams } from "./types";

const EMPTY_CTX: DomainAuthContext = {
  userId: null,
  roles: [],
  isAuthenticated: false,
  isOnboarded: false,
};

const Ctx = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  client: InkoraClient;
  /** platform OAuth strategy (web redirect vs mobile WebBrowser/Apple) */
  oauth?: OAuthAdapter;
  children: React.ReactNode;
}

/**
 * Shared AuthProvider — identical behavior on web and mobile.
 * Session persistence/refresh is handled by the injected client's storage adapter;
 * this component only mirrors auth state and derives roles + onboarding status.
 */
export function AuthProvider({ client, oauth = unsupportedOAuth, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
    user: null,
    ctx: EMPTY_CTX,
  });
  // onboarded_at is authoritative from the DB; cache it across token refreshes.
  const onboardedRef = useRef<boolean>(false);

  const buildCtx = useCallback((session: Session | null): DomainAuthContext => {
    if (!session) return EMPTY_CTX;
    return {
      userId: session.user.id as ProfileId,
      roles: rolesFromAccessToken(session.access_token),
      isAuthenticated: true,
      isOnboarded: onboardedRef.current,
    };
  }, []);

  const loadProfile = useCallback(
    async (session: Session | null) => {
      if (!session) {
        onboardedRef.current = false;
        return;
      }
      const { data } = await client
        .from("profiles")
        .select("onboarded_at")
        .eq("id", session.user.id)
        .maybeSingle();
      onboardedRef.current = Boolean((data as { onboarded_at: string | null } | null)?.onboarded_at);
    },
    [client],
  );

  const apply = useCallback(
    async (session: Session | null, withProfile: boolean) => {
      if (withProfile) await loadProfile(session);
      setState({
        status: session ? "authenticated" : "unauthenticated",
        session,
        user: session?.user ?? null,
        ctx: buildCtx(session),
      });
    },
    [buildCtx, loadProfile],
  );

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) void apply(data.session, true);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      // Re-read profile only on sign-in/initial; token refresh keeps the cached flag.
      const withProfile = event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED";
      void apply(session, withProfile);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client, apply]);

  const api = useMemo<AuthContextValue>(() => {
    return {
      ...state,
      async signInWithPassword(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        return error ? { ok: false, error: toAppError(error) } : { ok: true, value: undefined };
      },
      async signUpWithPassword({ email, password, displayName }: SignUpParams) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: displayName ? { display_name: displayName } : undefined },
        });
        if (error) return { ok: false, error: toAppError(error) };
        // If confirmations are on, there is no session yet.
        return { ok: true, value: { needsEmailConfirmation: !data.session } };
      },
      async signInWithGoogle() {
        return oauth.signInWithGoogle(client);
      },
      async signInWithApple() {
        return oauth.signInWithApple(client);
      },
      async signOut() {
        await client.auth.signOut();
      },
      async sendPasswordReset(email) {
        const { error } = await client.auth.resetPasswordForEmail(email);
        return error ? { ok: false, error: toAppError(error) } : { ok: true, value: undefined };
      },
      async refresh() {
        const { data } = await client.auth.getSession();
        await apply(data.session, true);
      },
    };
  }, [state, client, oauth, apply]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
