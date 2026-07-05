import { Ionicons } from "@expo/vector-icons";
import { addPortfolioImage, removePortfolioImage, useArtistPortfolio, useAuth } from "@inkora/data-access";
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

export function PortfolioManagerScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const portfolio = useArtistPortfolio(supabase, meId);
  const [uploading, setUploading] = useState(false);

  const images = portfolio.data ?? [];

  async function pickAndUpload() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      await addPortfolioImage(supabase, buf, asset.mimeType ?? "image/jpeg", ext);
      await qc.invalidateQueries({ queryKey: ["artist-portfolio", meId] });
      toast.show("Added to your portfolio");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  }

  function confirmRemove(id: string) {
    void confirm({
      title: "Remove photo?",
      message: "This removes it from your portfolio.",
      confirmLabel: "Remove",
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await removePortfolioImage(supabase, id);
        await qc.invalidateQueries({ queryKey: ["artist-portfolio", meId] });
      } catch (e) {
        toast.show((e as Error).message, "error");
      }
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">Portfolio</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Pressable style={[s.addBtn, uploading && s.disabled]} onPress={pickAndUpload} disabled={uploading} accessibilityRole="button" accessibilityLabel="Add a photo">
          {uploading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={s.addText}>Add a photo</Text>
            </>
          )}
        </Pressable>

        {portfolio.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : images.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="images-outline" size={26} color="#D4D4D8" />
            <Text style={s.emptyText}>No portfolio pieces yet. Add photos of your work so clients can see your style.</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {images.map((im) => (
              <View key={im.id} style={s.gridItem}>
                <Image source={{ uri: imageUrl(im.imagePath, 220) }} style={s.gridImg} contentFit="cover" accessibilityRole="image" accessibilityLabel="Portfolio piece" />
                <Pressable style={s.remove} onPress={() => confirmRemove(im.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove photo">
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 16 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  addText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.6 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyText: { color: "#A1A1AA", fontSize: 13, textAlign: "center", paddingHorizontal: 24, lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "48%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#E4E4E7" },
  gridImg: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
