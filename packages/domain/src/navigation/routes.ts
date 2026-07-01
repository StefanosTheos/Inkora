/**
 * SHARED NAVIGATION ROUTE TABLE
 * ------------------------------------------------------------------
 * The single source of truth for canonical paths, used by BOTH:
 *   - apps/mobile  (Expo Router + deep links / universal links)
 *   - apps/web     (Next App Router + canonical URLs / SEO)
 *
 * Path parity is the whole point: a link to `/artist/aria_ink` resolves the
 * same screen on mobile and the same page on web. Neither app hard-codes path
 * strings — they call these builders so URLs can never drift.
 *
 * NOTE: builders return PATHS ONLY (no scheme/host). Each app prepends its own
 * base (https://inkora.app for universal links, inkora:// for the custom scheme).
 */

export const ROUTE_NAMES = {
  // public / auth
  welcome: "welcome",
  signIn: "sign-in",
  signUp: "sign-up",
  onboarding: "onboarding",
  authCallback: "auth-callback",
  // primary tabs
  home: "home",
  discover: "discover",
  create: "create", // Favourites / Create Idea
  chats: "chats",
  profile: "profile",
  // entities
  artist: "artist",
  studio: "studio",
  idea: "idea",
  conversation: "conversation",
  booking: "booking",
  rewards: "rewards",
  // role modes
  artistDashboard: "artist-dashboard",
  studioDashboard: "studio-dashboard",
  admin: "admin",
} as const;

export type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES];

/** Centralized path builders. Add new routes here, never inline. */
export const routes = {
  welcome: () => "/welcome",
  signIn: () => "/sign-in",
  signUp: () => "/sign-up",
  onboarding: () => "/onboarding",
  authCallback: () => "/auth/callback",

  home: () => "/",
  discover: () => "/discover",
  create: () => "/create",
  chats: () => "/chats",
  profile: () => "/profile",

  artist: (handle: string) => `/artist/${handle}`,
  studio: (slug: string) => `/studio/${slug}`,
  idea: (ideaId: string) => `/idea/${ideaId}`,
  conversation: (conversationId: string) => `/chats/${conversationId}`,
  rewards: () => "/rewards",

  artistDashboard: () => "/artist-dashboard",
  studioDashboard: (studioId: string) => `/studio-dashboard/${studioId}`,
  admin: () => "/admin",
} as const;

// TODO: add `parseDeepLink(url: string)` returning a discriminated { name, params }
//       so push-notification payloads and universal links resolve identically.
