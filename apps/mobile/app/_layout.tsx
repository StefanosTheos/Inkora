import { useAuth } from "@inkora/data-access";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";

import { useProtectedRoute } from "../src/lib/use-protected-route";
import { AppProviders } from "../src/providers";

// Hold the splash until the session is restored to avoid an auth-state flash.
void SplashScreen.preventAutoHideAsync();

function Gate() {
  useProtectedRoute();
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);
  // A root Stack keeps (tabs) mounted when a sibling route (e.g. /rewards,
  // /bookings, /profile/settings) is pushed, so Back returns to the active
  // tab instead of re-mounting the tabs at Home.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Gate />
    </AppProviders>
  );
}
