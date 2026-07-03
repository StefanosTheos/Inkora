import { existsSync } from "node:fs";
import type { ExpoConfig } from "expo/config";
// Deep-linking scheme/host come from the SHARED route table package.
// import { SCHEME, UNIVERSAL_LINK_HOST } from "@inkora/domain/navigation";

const SCHEME = "inkora";
const UNIVERSAL_LINK_HOST = "inkora.app";

// Enables FCM push once you drop your Firebase google-services.json here.
// Guarded so builds still work before you've added it (push just stays off).
const GOOGLE_SERVICES = "./google-services.json";
const hasGoogleServices = existsSync(GOOGLE_SERVICES);

const config: ExpoConfig = {
  name: "Inkora",
  slug: "inkora",
  scheme: SCHEME, // inkora:// custom scheme (auth callbacks, push taps)
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-av", { microphonePermission: "Allow Inkora to record voice messages." }],
    ["expo-notifications", { color: "#E5484D" }],
  ],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "app.inkora.mobile",
    associatedDomains: [`applinks:${UNIVERSAL_LINK_HOST}`], // universal links
  },
  android: {
    package: "app.inkora.mobile",
    ...(hasGoogleServices ? { googleServicesFile: GOOGLE_SERVICES } : {}),
    // TODO: intentFilters for App Links (autoVerify) on https://inkora.app/*
  },
  extra: {
    // TODO: EXPO_PUBLIC_SUPABASE_URL / ANON_KEY surfaced via env (see src/lib/env.ts)
    router: {},
  },
};

export default config;
