// WebCrypto shim (crypto.subtle + TextEncoder) MUST load before anything else so
// Supabase auth can do PKCE S256 on Hermes without warning. Keep this first.
import "./src/lib/crypto-polyfill";

// Local entry so Metro/HMR resolves the entry from THIS package (pnpm monorepo:
// expo-router is hoisted to the repo root, which breaks HMR's project-relative lookup).
// The bare import below resolves via metro.config nodeModulesPaths (root).
import "expo-router/entry";
