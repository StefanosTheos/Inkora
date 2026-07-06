import { Ionicons } from "@expo/vector-icons";
import { journeyKeys, uploadJourneyPhoto,useAuth, useBookingJourneys } from "@inkora/data-access";
import { type JourneyMilestone, MILESTONE_LABEL, type MilestoneKind } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ImageZoomModal } from "../../components/ImageZoomModal";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../booking/components/ui";
import { JourneyStepper } from "./JourneyCard";

export function JourneyDetailScreen({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const journeys = useBookingJourneys(supabase);
  const [busy, setBusy] = useState<MilestoneKind | null>(null);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  const j = (journeys.data ?? []).find((x) => x.appointmentId === appointmentId);

  async function uploadFor(kind: MilestoneKind) {
    if (!meId) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setBusy(kind);
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      await uploadJourneyPhoto(supabase, appointmentId, kind, meId, buf, asset.mimeType ?? "image/jpeg", ext);
      await qc.invalidateQueries({ queryKey: journeyKeys.bookings });
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.show("Photo added · +20 pts");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.topTitle} accessibilityRole="header">Tattoo journey</Text>
        <View style={{ width: 26 }} />
      </View>

      {journeys.isLoading ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : !j ? (
        <View style={s.center}><Text style={s.muted}>Journey not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.artist}>{j.artistName}</Text>
          <Text style={s.date}>Session {fmtDate(j.scheduledStart)}</Text>

          <View style={s.stepperCard}><JourneyStepper stageIndex={j.stageIndex} /></View>

          <Text style={s.hint}>Earn +20 points per healing photo, and +100 when you complete the journey (all three photos + a review).</Text>

          {j.status !== "completed" ? (
            <Text style={s.muted}>Healing photos unlock after your session.</Text>
          ) : (
            <>
              <Text style={s.sectionTitle} accessibilityRole="header">Healing photos</Text>
              {j.milestones.map((m) => (
                <MilestoneRow key={m.kind} m={m} busy={busy === m.kind} onAdd={() => uploadFor(m.kind)} onZoom={(uri) => setZoomUri(uri)} />
              ))}

              {!j.hasReview ? (
                <Pressable style={s.reviewBtn} onPress={() => router.push(`/booking/${appointmentId}`)} accessibilityRole="button" accessibilityLabel="Leave a review">
                  <Text style={s.reviewBtnText}>Leave a review to complete your journey</Text>
                </Pressable>
              ) : j.stageIndex >= 4 ? (
                <View style={s.doneBanner}>
                  <Ionicons name="trophy" size={18} color="#16A34A" />
                  <Text style={s.doneText}>Journey complete — thanks for sharing your healing!</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} onClose={() => setZoomUri(null)} label="Healing photo" />
    </SafeAreaView>
  );
}

function MilestoneRow({ m, busy, onAdd, onZoom }: { m: JourneyMilestone; busy: boolean; onAdd: () => void; onZoom: (uri: string) => void }) {
  const label = `${MILESTONE_LABEL[m.kind]} after`;
  if (m.completed && m.photoPath) {
    return (
      <View style={s.msRow}>
        <Pressable onPress={() => onZoom(imageUrl(m.photoPath ?? undefined, 1200) ?? "")} accessibilityRole="imagebutton" accessibilityLabel={`${label} photo, tap to zoom`}>
          <Image source={{ uri: imageUrl(m.photoPath, 120) }} style={s.msThumb} contentFit="cover" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.msLabel}>{label}</Text>
          <Text style={s.msDone}>✓ Added · +20 pts</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={s.msRow}>
      <View style={[s.msThumb, s.msThumbEmpty, m.due && s.msThumbDue]}>
        <Ionicons name="camera-outline" size={22} color={m.due ? "#E5484D" : "#D4D4D8"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.msLabel}>{label}</Text>
        <Text style={[s.msSub, m.due && s.msDue]}>{m.due ? "Due now — add your photo" : `Due ${fmtDate(m.dueAt)}`}</Text>
      </View>
      <Pressable style={[s.addBtn, busy && s.addBtnBusy]} onPress={onAdd} disabled={busy} accessibilityRole="button" accessibilityLabel={`Add ${label} photo`}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.addBtnText}>Add</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6 },
  topTitle: { fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA", paddingHorizontal: 16 },
  body: { padding: 16, paddingBottom: 40 },
  artist: { fontSize: 22, fontWeight: "800" },
  date: { color: "#52525B", marginTop: 2, marginBottom: 12 },
  stepperCard: { borderWidth: 1, borderColor: "#EEE", borderRadius: 16, padding: 14 },
  hint: { color: "#71717A", fontSize: 13, lineHeight: 19, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 20, marginBottom: 8 },
  msRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  msThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#E4E4E7" },
  msThumbEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EEE", borderStyle: "dashed" },
  msThumbDue: { borderColor: "#E5484D", backgroundColor: "#FEF2F2" },
  msLabel: { fontWeight: "700", fontSize: 15, color: "#18181B" },
  msSub: { color: "#A1A1AA", fontSize: 13, marginTop: 2 },
  msDue: { color: "#E5484D", fontWeight: "600" },
  msDone: { color: "#16A34A", fontSize: 13, fontWeight: "600", marginTop: 2 },
  addBtn: { backgroundColor: "#E5484D", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minWidth: 60, alignItems: "center" },
  addBtnBusy: { opacity: 0.7 },
  addBtnText: { color: "#fff", fontWeight: "800" },
  reviewBtn: { marginTop: 16, backgroundColor: "#18181B", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  reviewBtnText: { color: "#fff", fontWeight: "800" },
  doneBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12 },
  doneText: { color: "#16A34A", fontWeight: "700", flex: 1 },
});
