import type { ProfileId } from "./ids";
import type { UserRole } from "./enums";

/**
 * Normalized auth context, derived from the Supabase session + the `app_roles`
 * JWT claim (injected by the custom_access_token_hook). Built by data-access's
 * AuthProvider and consumed identically by mobile and web.
 */
export interface AuthContext {
  userId: ProfileId | null;
  roles: UserRole[];       // from the `app_roles` claim
  isAuthenticated: boolean;
  isOnboarded: boolean;    // profiles.onboarded_at is set
}

export const hasRole = (ctx: AuthContext, role: UserRole): boolean => ctx.roles.includes(role);

// TODO: add helpers `canManageStudio`, `isArtist`, etc., once membership context shape is finalized.
