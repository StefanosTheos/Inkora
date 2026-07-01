import type { AuthContext, Result } from "@inkora/domain";
import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** normalized context (userId, roles from app_roles, isAuthenticated, isOnboarded) */
  ctx: AuthContext;
}

export interface SignUpParams {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthApi {
  signInWithPassword(email: string, password: string): Promise<Result<void>>;
  signUpWithPassword(params: SignUpParams): Promise<Result<{ needsEmailConfirmation: boolean }>>;
  signInWithGoogle(): Promise<Result<void>>;
  signInWithApple(): Promise<Result<void>>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<Result<void>>;
  /** re-read profile (onboarded_at, displayName) and roles after a change */
  refresh(): Promise<void>;
}

export type AuthContextValue = AuthState & AuthApi;
