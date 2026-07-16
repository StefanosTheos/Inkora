import { useAuth } from "@inkora/data-access";
import { useEffect } from "react";

import { syncPushRegistration } from "./notifications";
import { supabase } from "./supabase";

/**
 * On every authenticated boot, re-register the device's *current* FCM token if
 * the user has push enabled — without prompting. This keeps a live token on file
 * after rotation (reinstall/restore/periodic refresh); otherwise a stale token
 * gets 404'd by the server, disabled, and push silently stops. No-op for signed-
 * out users and for users who never opted into push.
 */
export function usePushSync(): void {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid || cancelled) return;
      const { data } = await supabase
        .from("notification_preferences")
        .select("channels")
        .eq("profile_id", uid)
        .maybeSingle();
      const pushEnabled = ((data?.channels ?? {}) as Record<string, unknown>)["push"] === true;
      if (!cancelled) await syncPushRegistration(pushEnabled);
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);
}
