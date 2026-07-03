import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { supabase } from "../../src/lib/supabase";

/**
 * Handles deep links opened from OUTSIDE an in-app browser session — e.g. a magic
 * link or email-confirmation link tapped in the mail app (inkora://auth/callback?code=…).
 * In-app OAuth (Google/Apple) is exchanged inside the OAuth adapter, not here.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const incoming = Linking.useURL();

  useEffect(() => {
    if (!incoming) return;
    const { queryParams } = Linking.parse(incoming);
    const code = queryParams?.code;
    if (typeof code !== "string") {
      router.replace("/welcome");
      return;
    }
    void supabase.auth.exchangeCodeForSession(code).then(({ error: e }) => {
      if (e) {
        setError(e.message);
        return;
      }
      // The root gate takes over from the new session (→ onboarding or home).
      router.replace("/");
    });
  }, [incoming, router]);

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E5484D", padding: 24, textAlign: "center" },
});
