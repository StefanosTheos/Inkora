import type { Result, StudioId } from "@inkora/domain";

import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

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

/**
 * Send the one-time welcome email (invoked when a new user consents to email
 * during onboarding). No-op server-side if email delivery isn't configured, so
 * this never blocks the signup flow.
 */
export async function sendWelcomeEmail(client: InkoraClient): Promise<Result<void>> {
  const { error } = await client.functions.invoke("send-welcome-email", { body: {} });
  if (error) return { ok: false, error: toAppError(error) };
  return { ok: true, value: undefined };
}
