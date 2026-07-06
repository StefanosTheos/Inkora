import { Ionicons } from "@expo/vector-icons";
import { markTypeNotificationsRead, useBookingJourneys } from "@inkora/data-access";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { JourneyCard } from "./JourneyCard";

export function JourneyListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const journeys = useBookingJourneys(supabase);
  const items = journeys.data ?? [];

  // Opening the journey hub clears the "new milestone" notifications.
  useEffect(() => {
    void (async () => {
      await markTypeNotificationsRead(supabase, "journey");
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    })();
  }, [qc]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.topTitle} accessibilityRole="header">Your tattoo journey</Text>
        <View style={{ width: 26 }} />
      </View>

      {journeys.isLoading ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : items.length === 0 ? (
        <View style={s.center}><Text style={s.muted}>Book a session to start tracking your tattoo journey end to end.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          {items.map((j) => (
            <JourneyCard key={j.appointmentId} journey={j} onPress={() => router.push(`/journey/${j.appointmentId}`)} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6 },
  topTitle: { fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: "#A1A1AA", textAlign: "center", lineHeight: 20 },
  body: { padding: 16 },
});
