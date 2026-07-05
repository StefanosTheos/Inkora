// Route: /artist-dashboard/portfolio — portfolio manager (upload coming in Phase 2).
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PortfolioManagerScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.headerTitle}>Portfolio</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={s.center}>
        <Ionicons name="images-outline" size={40} color="#D4D4D8" />
        <Text style={s.muted}>Portfolio upload is coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  muted: { color: "#71717A", fontWeight: "600" },
});
