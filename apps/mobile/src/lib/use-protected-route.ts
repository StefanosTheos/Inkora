import { useAuth } from "@inkora/data-access";
import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

/**
 * Expo Router auth/onboarding gate. Mirrors the web middleware logic so behavior
 * is consistent across platforms. RLS remains the real authorization boundary.
 */
export function useProtectedRoute() {
  const { status, ctx } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    const root = segments[0];
    const inAuthGroup = root === "(auth)" || root === "auth"; // (auth)/* and auth/callback
    const onOnboarding = segments.some((s) => s === "onboarding");

    if (status === "unauthenticated") {
      if (!inAuthGroup) router.replace("/welcome");
      return;
    }
    // authenticated:
    if (!ctx.isOnboarded && !onOnboarding) {
      router.replace("/onboarding");
    } else if (ctx.isOnboarded && inAuthGroup) {
      router.replace("/");
    }
  }, [status, ctx.isOnboarded, segments, router]);
}
