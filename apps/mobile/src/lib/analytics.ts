// Analytics singleton. Dev console tracker for now — swap for a PostHog RN
// adapter (same AnalyticsTracker interface) without touching call sites.
import { createConsoleTracker } from "@inkora/analytics";

export const analytics = createConsoleTracker(__DEV__);
