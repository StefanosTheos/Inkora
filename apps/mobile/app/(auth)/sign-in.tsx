import { useAuth } from "@inkora/data-access";
import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useToast } from "../../src/components/Toast";
import { env } from "../../src/lib/env";

export default function SignInScreen() {
  const { signInWithPassword, signInWithGoogle, signInWithApple } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // On success the root gate redirects automatically based on session + onboarding.
  async function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok && res.error) toast.show(res.error.message, "error");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={styles.primary} disabled={busy} onPress={() => run(() => signInWithPassword(email.trim(), password))}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}
      </Pressable>

      <Text style={styles.or}>or</Text>
      <Pressable style={styles.oauth} disabled={busy} onPress={() => run(signInWithGoogle)}>
        <Text style={styles.oauthText}>Continue with Google</Text>
      </Pressable>
      {env.APPLE_AUTH_ENABLED && (
        <Pressable style={[styles.oauth, styles.apple]} disabled={busy} onPress={() => run(signInWithApple)}>
          <Text style={[styles.oauthText, { color: "#fff" }]}>Continue with Apple</Text>
        </Pressable>
      )}

      <Link href="/sign-up" style={styles.link}>
        Don&apos;t have an account? Sign up
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 10, padding: 14, fontSize: 16 },
  primary: { backgroundColor: "#E5484D", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 4 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  or: { textAlign: "center", color: "#A1A1AA", marginVertical: 4 },
  oauth: { borderWidth: 1, borderColor: "#E4E4E7", padding: 14, borderRadius: 12, alignItems: "center" },
  apple: { backgroundColor: "#000", borderColor: "#000" },
  oauthText: { fontWeight: "600", fontSize: 15 },
  link: { textAlign: "center", color: "#E5484D", marginTop: 16, fontWeight: "600" },
});
