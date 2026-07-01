import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inkora</Text>
      <Text style={styles.subtitle}>Discover artists. Find your next tattoo.</Text>
      <Pressable style={styles.primary} onPress={() => router.push("/sign-up")}>
        <Text style={styles.primaryText}>Create account</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push("/sign-in")}>
        <Text style={styles.secondaryText}>I already have an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 40, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#71717A", textAlign: "center", marginBottom: 24 },
  primary: { backgroundColor: "#E5484D", padding: 16, borderRadius: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { padding: 16, alignItems: "center" },
  secondaryText: { color: "#18181B", fontWeight: "600" },
});
