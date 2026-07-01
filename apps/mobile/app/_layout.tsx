import { useAuth } from "@inkora/data-access";
import { Slot, SplashScreen } from "expo-router";
import { useEffect } from "react";
import { AppProviders } from "../src/providers";
import { useProtectedRoute } from "../src/lib/use-protected-route";

// Hold the splash until the session is restored to avoid an auth-state flash.
void SplashScreen.preventAutoHideAsync();

function Gate() {
  useProtectedRoute();
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Gate />
    </AppProviders>
  );
}
