import { Ionicons } from "@expo/vector-icons";
import { useAiPreview } from "@inkora/data-access";
import { AI_PREVIEW_DISCLAIMER, isPreviewPending } from "@inkora/domain";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { AiStatusChip, SignedPreviewImage } from "./components";

export function AiPreviewResultScreen({ id }: { id: string }) {
  const router = useRouter();
  const q = useAiPreview(supabase, id);
  const p = q.data;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle}>Your preview</Text>
        <View style={{ width: 26 }} />
      </View>

      {q.isLoading ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : !p ? (
        <View style={s.center}><Text style={s.muted}>Preview not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.stage}>
            <SignedPreviewImage path={p.sourceImagePath} style={s.stageImg} />
            {/* Result overlay — always the pending placeholder in the MVP. */}
            {isPreviewPending(p) && (
              <View style={s.overlay}>
                <View style={s.overlayInner}>
                  <Ionicons name="sparkles" size={30} color="#fff" />
                  <Text style={s.overlayTitle}>Preview is being prepared</Text>
                  <Text style={s.overlaySub}>AI rendering isn’t live yet — you’ll see the tattoo mapped onto your photo here.</Text>
                </View>
              </View>
            )}
          </View>

          <View style={s.statusRow}>
            <AiStatusChip status={p.status} />
            <Text style={s.muted}>Requested just now</Text>
          </View>

          {p.placement ? <Detail label="Placement" value={p.placement} /> : null}
          {p.prompt ? <Detail label="Idea" value={p.prompt} /> : null}

          <View style={s.note}>
            <Ionicons name="information-circle-outline" size={16} color="#92400E" />
            <Text style={s.noteText}>{AI_PREVIEW_DISCLAIMER}</Text>
          </View>

          <Pressable style={s.secondary} onPress={() => router.replace("/create/new")}>
            <Text style={s.secondaryText}>Try another photo</Text>
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
  stage: { borderRadius: 20, overflow: "hidden", backgroundColor: "#18181B", aspectRatio: 3 / 4 },
  stageImg: { width: "100%", height: "100%" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  overlayInner: { alignItems: "center", gap: 8 },
  overlayTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" },
  overlaySub: { color: "#E4E4E7", fontSize: 13, textAlign: "center", lineHeight: 19 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  detail: { marginTop: 14 },
  detailLabel: { color: "#71717A", fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 15, color: "#18181B", marginTop: 4 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginTop: 20 },
  noteText: { flex: 1, color: "#92400E", fontSize: 12, fontWeight: "600" },
  secondary: { marginTop: 20, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  secondaryText: { fontWeight: "700", color: "#18181B" },
});
