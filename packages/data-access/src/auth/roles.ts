import type { UserRole } from "@inkora/domain";

/**
 * The product speaks of 4 roles (user / artist / studio / admin).
 * The database enum (user_role) uses: seeker / artist / studio_admin / moderator.
 * This is the single mapping between the two vocabularies.
 */
export type AppRole = "user" | "artist" | "studio" | "admin";

export const APP_ROLE_TO_DB: Record<AppRole, UserRole> = {
  user: "seeker",
  artist: "artist",
  studio: "studio_admin",
  admin: "moderator",
};

export const DB_ROLE_TO_APP: Record<UserRole, AppRole> = {
  seeker: "user",
  artist: "artist",
  studio_admin: "studio",
  moderator: "admin",
};

/** Highest-privilege-first, for choosing a landing destination. */
const ROLE_PRECEDENCE: UserRole[] = ["moderator", "studio_admin", "artist", "seeker"];

export function primaryRole(roles: UserRole[]): UserRole {
  for (const r of ROLE_PRECEDENCE) if (roles.includes(r)) return r;
  return "seeker";
}

export function hasRole(roles: UserRole[], role: UserRole): boolean {
  return roles.includes(role);
}

/**
 * Where a freshly-authenticated, onboarded user should land, by role.
 * Returns a path from the shared route table vocabulary (apps map it to their router).
 */
export function homePathForRoles(roles: UserRole[]): string {
  switch (primaryRole(roles)) {
    case "moderator":
      return "/admin/moderation";
    case "studio_admin":
      return "/studio-dashboard";
    case "artist":
      return "/artist-dashboard";
    default:
      return "/"; // seeker → home feed
  }
}

/** Roles a user may grant themselves (self-service). admin/moderator is NEVER self-granted. */
export const SELF_GRANTABLE: AppRole[] = ["artist", "studio"];
