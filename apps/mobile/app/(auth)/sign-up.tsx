import { useAuth } from "@inkora/data-access";
import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useToast } from "../../src/components/Toast";
import { env } from "../../src/lib/env";

export default function SignUpScreen() {
  const { signUpWithPassword, signInWithGoogle, signInWithApple } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const PASSWORD_MIN = 8; // matches the input hint (Supabase's own default is only 6)

  async function onSignUp() {
    const mail = email.trim();
    if (!mail) { toast.show("Enter your email", "error"); return; }
    if (password.length < PASSWORD_MIN) { toast.show(`Password must be at least ${PASSWORD_MIN} characters`, "error"); return; }
    setBusy(true);
    const res = await signUpWithPassword({ email: mail, password, displayName: displayName.trim() });
    setBusy(false);
    if (!res.ok) {
      toast.show(res.error.message, "error");
      return;
    }
    // Email confirmation is intentionally not used (kept disabled server-side —
    // not worth the production email cost), so signUp always returns a session
    // and the root gate routes new users straight to /onboarding (handle_new_user
    // already made the profile + seeker role).
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>
      <TextInput style={styles.input} placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="Password (min 8 chars)" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={styles.primary} disabled={busy} onPress={onSignUp}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create account</Text>}
      </Pressable>

      <Text style={styles.or}>or</Text>
      <Pressable style={styles.oauth} disabled={busy} onPress={signInWithGoogle}>
        <Text style={styles.oauthText}>Continue with Google</Text>
      </Pressable>
      {env.APPLE_AUTH_ENABLED && (
        <Pressable style={[styles.oauth, styles.apple]} disabled={busy} onPress={signInWithApple}>
          <Text style={[styles.oauthText, { color: "#fff" }]}>Continue with Apple</Text>
        </Pressable>
      )}

      <Link href="/sign-in" style={styles.link}>
        Already have an account? Sign in
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
