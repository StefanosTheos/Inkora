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

const LOGO = "./assets/images/inkora_logo.png";                 // full logo (with text) — splash
const ICON = "./assets/images/inkora_icon.png"; // mark only, extra-padded — app icon

const config: ExpoConfig = {
  name: "Inkora",
  slug: "inkora",
  owner: "stefanos_theos", // EAS account that owns the project
  scheme: SCHEME, // inkora:// custom scheme (auth callbacks, push taps)
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: ICON,
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-av", { microphonePermission: "Allow Inkora to record voice messages." }],
    ["expo-notifications", { color: "#E5484D" }],
    ["expo-image-picker", {
      photosPermission: "Allow Inkora to access your photos to try a design on your body.",
      cameraPermission: "Allow Inkora to use the camera to photograph where you'd like a tattoo.",
    }],
    ["expo-media-library", {
      savePhotosPermission: "Allow Inkora to save your tattoo try-on to your photos.",
      isAccessMediaLocationEnabled: false,
    }],
    // Native splash: same logo + size as the animated intro so the handoff
    // is seamless (imageWidth matches AnimatedSplash's 240px logo).
    ["expo-splash-screen", { image: LOGO, imageWidth: 240, resizeMode: "contain", backgroundColor: "#000000" }],
  ],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "app.inkora.mobile",
    associatedDomains: [`applinks:${UNIVERSAL_LINK_HOST}`], // universal links
  },
  android: {
    package: "app.inkora.mobile",
    adaptiveIcon: { foregroundImage: ICON, backgroundColor: "#000000" },
    ...(hasGoogleServices ? { googleServicesFile: GOOGLE_SERVICES } : {}),
    // TODO: intentFilters for App Links (autoVerify) on https://inkora.app/*
  },
  extra: {
    // TODO: EXPO_PUBLIC_SUPABASE_URL / ANON_KEY surfaced via env (see src/lib/env.ts)
    router: {},
    // EAS project link (from `eas init`). Required for `eas build`.
    eas: { projectId: "93d41163-ac9d-47eb-81fd-d3b9f63b0559" },
  },
};

export default config;
