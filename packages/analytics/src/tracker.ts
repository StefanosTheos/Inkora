import type { AuthContext, ProfileId } from "@inkora/domain";
import type { AnalyticsEvent } from "./events";

/** Platform-injected (PostHog web SDK vs RN SDK), same interface both apps. */
export interface AnalyticsTracker {
  capture<E extends AnalyticsEvent>(event: E, ctx: AuthContext): void;
  identify(userId: ProfileId, traits: Record<string, unknown>): void;
  reset(): void; // on sign-out
}

/**
 * Dev/no-op tracker implementing the same interface. Apps use this until a
 * PostHog adapter is wired — swapping the implementation needs no call-site changes.
 * TODO: implement PostHog (web + RN) adapters; no PII in props.
 */
export function createConsoleTracker(enabled = true): AnalyticsTracker {
  return {
    capture(event, ctx) {
      if (enabled) console.log(`[analytics] ${event.name}`, event.props, { userId: ctx.userId });
    },
    identify(userId, traits) {
      if (enabled) console.log("[analytics] identify", userId, traits);
    },
    reset() {
      if (enabled) console.log("[analytics] reset");
    },
  };
}
