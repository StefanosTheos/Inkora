// @inkora/data-access — public surface
export * from "./ai"; // AI tattoo preview — PLACEHOLDER persistence + source upload (no inference)
export * from "./artist"; // artist profile: header, portfolio, reviews, offers, availability
export * from "./auth"; // AuthProvider, useAuth, roles, profile/onboarding, role elevation
export * from "./booking"; // requests, offers, appointments, open slots, artist approval flow
export * from "./client";
export * from "./dashboard"; // user dashboard: profile summary, saved artists/designs, journey
export * from "./errors";
export * from "./home"; // home page sections + infinite feed
export * from "./hooks";
export * from "./ideas"; // tattoo idea detail, similar ideas, save design
export * from "./location"; // city → coordinates geocoding (Nominatim)
export * from "./messaging"; // conversations, realtime chat, uploads, typing, read receipts
export * from "./notifications"; // realtime in-app inbox + unread count
export * from "./onboarding"; // style questionnaire: deck, controller, preferences, recommendations
export * from "./portfolio"; // portfolio piece detail (same UX as idea detail) + save
export { QueryProvider } from "./providers/query-provider";
export * from "./query-keys";
export * from "./realtime";
export * from "./repositories";
export * from "./rewards"; // points engine, vouchers, referrals, profile completion
export * from "./search"; // full-text artist search + filters/sort hooks
export * from "./services";
export * from "./storage";
export * from "./studio"; // studio profile: header + roster
