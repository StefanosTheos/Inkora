// @inkora/data-access — public surface
export * from "./client";
export * from "./errors";
export * from "./query-keys";
export * from "./repositories";
export * from "./services";
export * from "./realtime";
export * from "./storage";
export * from "./hooks";
export * from "./onboarding"; // style questionnaire: deck, controller, preferences, recommendations
export * from "./home"; // home page sections + infinite feed
export * from "./location"; // city → coordinates geocoding (Nominatim)
export * from "./search"; // full-text artist search + filters/sort hooks
export * from "./artist"; // artist profile: header, portfolio, reviews, offers, availability
export * from "./studio"; // studio profile: header + roster
export * from "./messaging"; // conversations, realtime chat, uploads, typing, read receipts
export * from "./booking"; // requests, offers, appointments, open slots, artist approval flow
export * from "./notifications"; // realtime in-app inbox + unread count
export * from "./rewards"; // points engine, vouchers, referrals, profile completion
export * from "./dashboard"; // user dashboard: profile summary, saved artists/designs, journey
export * from "./ai"; // AI tattoo preview — PLACEHOLDER persistence + source upload (no inference)
export * from "./auth"; // AuthProvider, useAuth, roles, profile/onboarding, role elevation
export { QueryProvider } from "./providers/query-provider";
