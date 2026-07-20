import { useConversationsRealtime } from "@inkora/data-access";
import { SplashScreen, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { supabase } from "../src/lib/supabase";
import { useNotificationRouting } from "../src/lib/use-notification-routing";
import { useProtectedRoute } from "../src/lib/use-protected-route";
import { usePushSync } from "../src/lib/use-push-sync";
import { AppProviders } from "../src/providers";

// Hold the native (static) splash until JS has painted, then hand off to the
// animated intro so there's no flash of the app underneath.
void SplashScreen.preventAutoHideAsync();

function Gate() {
  useProtectedRoute();
  usePushSync();
  useNotificationRouting();
  useConversationsRealtime(supabase);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    // Reveal the animated splash (already painted) by hiding the native one.
    void SplashScreen.hideAsync();
  }, []);

  // A root Stack keeps (tabs) mounted when a sibling route (e.g. /rewards,
  // /bookings, /profile/settings) is pushed, so Back returns to the active
  // tab instead of re-mounting the tabs at Home.
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
      </Stack>
      {!introDone ? <AnimatedSplash onDone={() => setIntroDone(true)} /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Gate />
    </AppProviders>
  );
}
