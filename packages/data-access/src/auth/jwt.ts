import type { UserRole } from "@inkora/domain";

/**
 * Decode a JWT payload WITHOUT verifying the signature.
 * Safe for client-side reads of non-sensitive claims (e.g. `app_roles`) only —
 * the signature is verified server-side by Supabase/PostgREST. Works in both
 * Hermes (RN >= 0.74) and browsers via the global `atob`.
 */
export function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Read the `app_roles` claim injected by the custom_access_token_hook. */
export function rolesFromAccessToken(accessToken: string | undefined | null): UserRole[] {
  if (!accessToken) return [];
  const payload = decodeJwtPayload(accessToken);
  const roles = payload?.["app_roles"];
  if (!Array.isArray(roles)) return [];
  return roles.filter((r): r is UserRole => typeof r === "string") as UserRole[];
}
