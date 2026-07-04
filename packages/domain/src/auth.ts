import type { UserRole } from "./enums";
import type { ProfileId } from "./ids";

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

/** Human-readable role label: "studio_admin" → "Studio Admin", "artist" → "Artist". */
export function formatRoleLabel(role: string): string {
  return role
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// TODO: add helpers `canManageStudio`, `isArtist`, etc., once membership context shape is finalized.
