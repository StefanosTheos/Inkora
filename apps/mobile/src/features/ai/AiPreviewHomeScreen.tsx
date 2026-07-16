import { Ionicons } from "@expo/vector-icons";
import { aiKeys, deleteAiPreview, useAiPreviews, useFlashes } from "@inkora/data-access";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { SignedPreviewImage } from "./components";

export function AiPreviewHomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const previews = useAiPreviews(supabase);
  const flashes = useFlashes(supabase);
  const recent = (previews.data ?? []).filter((p) => p.resultImagePath);
  const flashList = flashes.data ?? [];

  async function confirmDelete(id: string, resultImagePath: string | null) {
    const ok = await confirm({ title: "Delete this try-on?", message: "This mockup will be permanently removed.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      await deleteAiPreview(supabase, id, resultImagePath);
      await qc.invalidateQueries({ queryKey: aiKeys.list });
      toast.show("Try-on deleted");
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title}>Try it on</Text>
        <Text style={s.subtitle}>See how a design looks on your skin before you book.</Text>

        {/* Start CTA */}
        <Pressable style={s.cta} onPress={() => router.push("/create/new")} accessibilityRole="button" accessibilityLabel="Start a new try-on">
          <View style={s.ctaIcon}><Ionicons name="sparkles" size={24} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>New try-on</Text>
            <Text style={s.ctaSub}>Pick a flash, add a photo, place it on you.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>

        {/* Your try-ons */}
        {previews.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : recent.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Your try-ons</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
              {recent.map((p) => (
                <View key={p.id} style={s.previewCard}>
                  <Pressable onPress={() => router.push(`/create/${p.id}`)} accessibilityRole="button" accessibilityLabel="Open try-on">
                    <SignedPreviewImage path={p.resultImagePath} style={s.previewImg} />
                  </Pressable>
                  <Pressable style={s.deleteBtn} onPress={() => void confirmDelete(p.id, p.resultImagePath)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete this try-on">
                    <Ionicons name="close" size={15} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Flashes to try on */}
        <Text style={s.sectionTitle}>Flashes to try on</Text>
        <Text style={s.muted}>Ready-to-tattoo designs from artists — tap one to see it on you.</Text>
        {flashes.isLoading ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : flashList.length === 0 ? (
          <Text style={s.muted}>No flash designs available yet.</Text>
        ) : (
          <View style={s.grid}>
            {flashList.map((f) => (
              <Pressable
                key={f.id}
                style={s.exampleCard}
                onPress={() => router.push({ pathname: "/create/new", params: { flashPath: f.imagePath, flashId: f.id, artistName: f.artistName, caption: f.caption ?? "" } })}
                accessibilityRole="button"
                accessibilityLabel={f.caption ?? `Flash by ${f.artistName}`}
              >
                <Image source={{ uri: imageUrl(f.imagePath, 300) ?? undefined }} style={s.exampleImg} contentFit="cover" />
                <Text style={s.exampleLabel} numberOfLines={1}>{f.caption ?? f.artistName}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  body: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#71717A", marginTop: 2 },
  muted: { color: "#A1A1AA", fontSize: 13, marginBottom: 8 },
  cta: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#18181B", borderRadius: 20, padding: 18, marginTop: 16 },
  ctaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center" },
  ctaTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaSub: { color: "#D4D4D8", fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 24, marginBottom: 4 },
  hRow: { gap: 12, paddingVertical: 8 },
  previewCard: { width: 150 },
  previewImg: { width: 150, height: 190, borderRadius: 16, backgroundColor: "#E4E4E7" },
  deleteBtn: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  exampleCard: { width: "47%" },
  exampleImg: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: "#E4E4E7" },
  exampleLabel: { fontWeight: "600", fontSize: 13, marginTop: 6 },
});
