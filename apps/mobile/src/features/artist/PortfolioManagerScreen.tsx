import { Ionicons } from "@expo/vector-icons";
import { addPortfolioImage, removePortfolioImage, useArtistFlashes, useArtistPortfolio, useAuth } from "@inkora/data-access";
import type { PortfolioImage } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";

type Kind = "portfolio" | "flash";

export function PortfolioManagerScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const portfolio = useArtistPortfolio(supabase, meId);
  const flashes = useArtistFlashes(supabase, meId);
  const [uploading, setUploading] = useState<Kind | null>(null);
  const [tab, setTab] = useState<Kind>("portfolio");

  const queryKey = (kind: Kind) => [kind === "flash" ? "artist-flashes" : "artist-portfolio", meId] as const;

  async function pickAndUpload(kind: Kind) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(kind);
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      await addPortfolioImage(supabase, buf, asset.mimeType ?? "image/jpeg", ext, undefined, kind);
      await qc.invalidateQueries({ queryKey: queryKey(kind) });
      toast.show(kind === "flash" ? "Added to your flashes" : "Added to your portfolio");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setUploading(null);
    }
  }

  function confirmRemove(id: string, kind: Kind) {
    void confirm({
      title: "Remove photo?",
      message: kind === "flash" ? "This removes it from your flashes." : "This removes it from your portfolio.",
      confirmLabel: "Remove",
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await removePortfolioImage(supabase, id);
        await qc.invalidateQueries({ queryKey: queryKey(kind) });
      } catch (e) {
        toast.show((e as Error).message, "error");
      }
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">Portfolio & Flashes</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={s.tabs}>
        <TabButton label={`Portfolio${portfolio.data?.length ? ` (${portfolio.data.length})` : ""}`} active={tab === "portfolio"} onPress={() => setTab("portfolio")} />
        <TabButton label={`Flashes${flashes.data?.length ? ` (${flashes.data.length})` : ""}`} active={tab === "flash"} onPress={() => setTab("flash")} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {tab === "portfolio" ? (
          <ImageSection
            hint="Photos of your work so clients can see your style."
            addLabel="Add portfolio photo"
            emptyText="No portfolio pieces yet."
            images={portfolio.data ?? []}
            loading={portfolio.isLoading}
            uploading={uploading === "portfolio"}
            onAdd={() => pickAndUpload("portfolio")}
            onRemove={(id) => confirmRemove(id, "portfolio")}
          />
        ) : (
          <ImageSection
            hint="Ready-to-tattoo designs clients can book directly — no consultation needed."
            addLabel="Add flash design"
            emptyText="No flash designs yet."
            images={flashes.data ?? []}
            loading={flashes.isLoading}
            uploading={uploading === "flash"}
            onAdd={() => pickAndUpload("flash")}
            onRemove={(id) => confirmRemove(id, "flash")}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ImageSection({
  hint, addLabel, emptyText, images, loading, uploading, onAdd, onRemove,
}: {
  hint: string; addLabel: string; emptyText: string;
  images: PortfolioImage[]; loading: boolean; uploading: boolean;
  onAdd: () => void; onRemove: (id: string) => void;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionHint}>{hint}</Text>
      <Pressable style={[s.addBtn, uploading && s.disabled]} onPress={onAdd} disabled={uploading} accessibilityRole="button" accessibilityLabel={addLabel}>
        {uploading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addText}>{addLabel}</Text>
          </>
        )}
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : images.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={26} color="#D4D4D8" />
          <Text style={s.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <View style={s.grid}>
          {images.map((im) => (
            <View key={im.id} style={s.gridItem}>
              <Image source={{ uri: imageUrl(im.imagePath, 220) }} style={s.gridImg} contentFit="cover" accessibilityRole="image" accessibilityLabel="Portfolio piece" />
              <Pressable style={s.remove} onPress={() => onRemove(im.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove photo">
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8, marginBottom: 4 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F4F4F5" },
  tabActive: { backgroundColor: "#18181B" },
  tabText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  tabTextActive: { color: "#fff" },
  body: { padding: 16 },
  section: { marginBottom: 28 },
  sectionHint: { color: "#71717A", fontSize: 13, marginTop: 2, marginBottom: 12, lineHeight: 18 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  addText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.6 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyText: { color: "#A1A1AA", fontSize: 13, textAlign: "center", paddingHorizontal: 24, lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "48%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#E4E4E7" },
  gridImg: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
