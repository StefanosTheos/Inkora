import { Ionicons } from "@expo/vector-icons";
import { useAiPreview, usePortfolioDesign } from "@inkora/data-access";
import { AI_PREVIEW_DISCLAIMER } from "@inkora/domain";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { SignedPreviewImage } from "./components";

export function AiPreviewResultScreen({ id }: { id: string }) {
  const router = useRouter();
  const q = useAiPreview(supabase, id);
  const p = q.data;
  const flashQ = usePortfolioDesign(supabase, p?.sourceFlashId ?? "");
  const flash = flashQ.data;
  const artist = flash?.artist;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle}>Your try-on</Text>
        <View style={{ width: 26 }} />
      </View>

      {q.isLoading ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : !p ? (
        <View style={s.center}><Text style={s.muted}>Try-on not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.stage}>
            <SignedPreviewImage path={p.resultImagePath} style={s.stageImg} />
          </View>

          {p.placement ? <Detail label="Placement" value={p.placement} /> : null}

          <View style={s.note}>
            <Ionicons name="information-circle-outline" size={16} color="#92400E" />
            <Text style={s.noteText}>{AI_PREVIEW_DISCLAIMER}</Text>
          </View>

          {artist ? (
            <Pressable
              style={[s.book, !artist.isAccepting && s.bookOff]}
              disabled={!artist.isAccepting}
              onPress={() => router.push({ pathname: "/booking-request", params: { artistId: artist.id, refPath: flash?.imagePath ?? "" } })}
              accessibilityRole="button"
              accessibilityLabel={artist.isAccepting ? `Book this design with ${artist.displayName}` : "Artist not accepting bookings"}
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={s.bookText}>{artist.isAccepting ? `Book this with ${artist.displayName}` : "Artist not accepting bookings"}</Text>
            </Pressable>
          ) : null}

          {flash ? (
            <Pressable style={s.secondary} onPress={() => router.push(`/artist/${flash.artist?.id}`)} accessibilityRole="button" accessibilityLabel="View the artist">
              <Text style={s.secondaryText}>View {artist?.displayName ?? "artist"}’s profile</Text>
            </Pressable>
          ) : null}

          <Pressable style={s.secondary} onPress={() => router.replace("/create/new")} accessibilityRole="button" accessibilityLabel="Try another design">
            <Text style={s.secondaryText}>Try another design</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detail}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA", fontSize: 13 },
  body: { padding: 16, paddingBottom: 40 },
  stage: { borderRadius: 20, overflow: "hidden", backgroundColor: "#0B0B0F", aspectRatio: 3 / 4 },
  stageImg: { width: "100%", height: "100%" },
  detail: { marginTop: 14 },
  detailLabel: { color: "#71717A", fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 15, color: "#18181B", marginTop: 4 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginTop: 16 },
  noteText: { flex: 1, color: "#92400E", fontSize: 12, fontWeight: "600" },
  book: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, marginTop: 18 },
  bookOff: { backgroundColor: "#D4D4D8" },
  bookText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondary: { marginTop: 10, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  secondaryText: { fontWeight: "700", color: "#18181B" },
});
