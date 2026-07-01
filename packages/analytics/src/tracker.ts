import type { AuthContext, ProfileId } from "@inkora/domain";
import type { AnalyticsEvent } from "./events";

/** Platform-injected (PostHog web SDK vs RN SDK), same interface both apps. */
export interface AnalyticsTracker {
  capture<E extends AnalyticsEvent>(event: E, ctx: AuthContext): void;
  identify(userId: ProfileId, traits: Record<string, unknown>): void;
  reset(): void; // on sign-out
}

// TODO: implement PostHog adapters in each app; no PII in props.
