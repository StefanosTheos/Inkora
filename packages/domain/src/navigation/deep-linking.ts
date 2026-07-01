/**
 * Deep-linking config shared by both apps.
 * - Mobile registers `SCHEME` (custom) + `UNIVERSAL_LINK_HOST` (https) in app.config.ts.
 * - Web serves the same paths as canonical URLs (the universal-link fallback target).
 */
export const SCHEME = "inkora";
export const UNIVERSAL_LINK_HOST = "inkora.app";

export interface ParsedLink {
  /** matched route name from ROUTE_NAMES, or null if unrecognized */
  name: string | null;
  params: Record<string, string>;
}

// TODO: implement parseLink(url) used by:
//   - mobile: push-notification `data.path` taps + OS-delivered universal links
//   - web:    middleware redirects / share targets
// Keep it pure (string in → ParsedLink out) so both runtimes share it.
