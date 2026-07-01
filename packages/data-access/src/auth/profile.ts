import type { Result, StudioId } from "@inkora/domain";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

export interface OnboardingInput {
  displayName: string;
  username?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  searchRadiusKm?: number;
}

/**
 * Completes the profile created by the handle_new_user DB trigger and marks
 * onboarding done. RLS (profiles_update_own) restricts this to the caller's row.
 * Call `auth.refresh()` afterward so `isOnboarded` flips in the AuthContext.
 */
export async function completeOnboarding(client: InkoraClient, input: OnboardingInput): Promise<Result<void>> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false, error: { code: "unauthenticated", message: "Not signed in", retriable: false } };

  const { error } = await client
    .from("profiles")
    .update({
      display_name: input.displayName,
      username: input.username ?? null,
      city: input.city ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      search_radius_km: input.searchRadiusKm ?? 25,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", uid);

  return error ? { ok: false, error: toAppError(error) } : { ok: true, value: undefined };
}

/**
 * Self-service role elevation to ARTIST. role_grants has no client write policy,
 * so this goes through a privileged Edge Function (service_role). After success the
 * caller MUST refresh the session so the new `app_roles` claim is minted.
 */
export async function becomeArtist(client: InkoraClient, headline?: string): Promise<Result<void>> {
  const { error } = await client.functions.invoke("become-artist", { body: { headline } });
  if (error) return { ok: false, error: toAppError(error) };
  await client.auth.refreshSession(); // re-mint JWT with artist role
  return { ok: true, value: undefined };
}

export interface CreateStudioInput {
  name: string;
  city?: string;
  latitude: number;
  longitude: number;
}

/** Self-service STUDIO creation: creates the studio + grants studio_admin (privileged). */
export async function createStudio(client: InkoraClient, input: CreateStudioInput): Promise<Result<StudioId>> {
  const { data, error } = await client.functions.invoke<{ studioId: StudioId }>("create-studio", { body: input });
  if (error || !data) return { ok: false, error: toAppError(error ?? new Error("no studio returned")) };
  await client.auth.refreshSession(); // re-mint JWT with studio_admin role
  return { ok: true, value: data.studioId };
}
