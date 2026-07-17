// Route: /style-quiz — re-take the tattoo style questionnaire after onboarding.
// Reuses the seeker deck + taste board; on finish it saves preferences and
// returns to Home (refreshing the Recommended rail) rather than continuing to
// the comms-consent step. Reached from Home's "Take the style quiz" CTA (shown
// when the user has no style preferences yet).
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SeekerOnboarding } from "../src/features/onboarding/OnboardingFlow";

export default function StyleQuizScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  function onComplete() {
    // Preferences changed → the Recommended rail and empty-state CTA both key
    // off these, so refresh them before returning Home.
    void qc.invalidateQueries({ queryKey: ["recommended-for-me"] });
    void qc.invalidateQueries({ queryKey: ["my-style-slugs"] });
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.barTitle}>Style quiz</Text>
        <View style={{ width: 26 }} />
      </View>
      <SeekerOnboarding onComplete={onComplete} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8 },
  barTitle: { fontSize: 16, fontWeight: "800", color: "#18181B" },
});
