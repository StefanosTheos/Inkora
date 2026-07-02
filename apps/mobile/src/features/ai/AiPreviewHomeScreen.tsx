import { Ionicons } from "@expo/vector-icons";
import { publicStorageUrl, useAiPreviews } from "@inkora/data-access";
import { MOCK_PREVIEW_EXAMPLES } from "@inkora/ai";
import { AI_PREVIEW_DISCLAIMER } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { AiStatusChip, SignedPreviewImage } from "./components";

const img = (p: string) => publicStorageUrl(env.SUPABASE_URL, p);

export function AiPreviewHomeScreen() {
  const router = useRouter();
  const previews = useAiPreviews(supabase);
  const recent = previews.data ?? [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title}>AI Preview</Text>
        <Text style={s.subtitle}>See how a design could look on your skin.</Text>

        {/* Placeholder disclaimer */}
        <View style={s.banner}>
          <Ionicons name="sparkles-outline" size={16} color="#92400E" />
          <Text style={s.bannerText}>{AI_PREVIEW_DISCLAIMER}</Text>
        </View>

        {/* Start CTA */}
        <Pressable style={s.cta} onPress={() => router.push("/create/new")}>
          <View style={s.ctaIcon}><Ionicons name="camera" size={26} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Try a tattoo on your skin</Text>
            <Text style={s.ctaSub}>Upload a photo, pick a design, preview the placement.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>

        {/* Recent previews */}
        {previews.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : recent.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Your previews</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
              {recent.map((p) => (
                <Pressable key={p.id} style={s.previewCard} onPress={() => router.push(`/create/${p.id}`)}>
                  <SignedPreviewImage path={p.sourceImagePath} style={s.previewImg} />
                  <View style={s.previewMeta}>
                    <AiStatusChip status={p.status} />
                    <Text style={s.previewLabel} numberOfLines={1}>{p.placement ?? p.prompt ?? "Preview"}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Example styles (mock gallery) */}
        <Text style={s.sectionTitle}>Example styles</Text>
        <Text style={s.muted}>A taste of the styles you’ll be able to preview.</Text>
        <View style={s.grid}>
          {MOCK_PREVIEW_EXAMPLES.map((ex) => (
            <View key={ex.id} style={s.exampleCard}>
              <Image source={{ uri: img(ex.imagePath) }} style={s.exampleImg} contentFit="cover" />
              <Text style={s.exampleLabel} numberOfLines={1}>{ex.label}</Text>
            </View>
          ))}
        </View>
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
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginTop: 14 },
  bannerText: { flex: 1, color: "#92400E", fontSize: 12, fontWeight: "600" },
  cta: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#18181B", borderRadius: 20, padding: 18, marginTop: 16 },
  ctaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center" },
  ctaTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaSub: { color: "#D4D4D8", fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 24, marginBottom: 4 },
  hRow: { gap: 12, paddingVertical: 8 },
  previewCard: { width: 150 },
  previewImg: { width: 150, height: 190, borderRadius: 16 },
  previewMeta: { marginTop: 6, gap: 4 },
  previewLabel: { fontWeight: "600", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  exampleCard: { width: "47%" },
  exampleImg: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: "#E4E4E7" },
  exampleLabel: { fontWeight: "600", fontSize: 13, marginTop: 6 },
});
