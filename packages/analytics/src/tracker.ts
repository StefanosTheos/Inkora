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

/** Minimal PostHog client shape (matches posthog-react-native / posthog-js). */
export interface PostHogLike {
  capture(event: string, properties?: Record<string, unknown>): void;
  identify(distinctId: string, properties?: Record<string, unknown>): void;
  reset(): void;
}

/**
 * Real PostHog adapter — dependency-injected so this package stays platform-
 * agnostic (no SDK dependency). Each app instantiates its PostHog client
 * (posthog-react-native / posthog-js) and passes it here; call sites are
 * unchanged. Props carry no PII beyond the coarse primary role.
 */
export function createPostHogTracker(posthog: PostHogLike): AnalyticsTracker {
  return {
    capture(event, ctx) {
      posthog.capture(event.name, { ...event.props, role: ctx.roles[0] ?? "seeker" });
    },
    identify(userId, traits) {
      posthog.identify(userId, traits);
    },
    reset() {
      posthog.reset();
    },
  };
}
