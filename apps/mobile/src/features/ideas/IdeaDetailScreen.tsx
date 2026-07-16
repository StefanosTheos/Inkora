import { Ionicons } from "@expo/vector-icons";
import { useIdeaDetail, useIdeaSaved, useSimilarIdeas } from "@inkora/data-access";
import type { IdeaCard } from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ImageZoomModal } from "../../components/ImageZoomModal";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";

export function IdeaDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const detail = useIdeaDetail(supabase, id);
  const similar = useSimilarIdeas(supabase, id);
  const save = useIdeaSaved(supabase, id);
  const [zoom, setZoom] = useState(false);

  if (detail.isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }
  const d = detail.data;
  if (!d) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><Text style={s.muted}>This design is no longer available.</Text></View>
      </SafeAreaView>
    );
  }

  const aspect = d.width && d.height ? d.width / d.height : 1;
  const artist = d.artist;

  const onToggleSave = () => {
    const next = !save.saved;
    save.toggle();
    toast.show(next ? "Saved to your designs" : "Removed from saved");
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.body}>
        <Pressable onPress={() => setZoom(true)} accessibilityRole="imagebutton" accessibilityLabel={`${d.title ?? "Tattoo design"}. Tap to zoom`}>
          <Image source={{ uri: imageUrl(d.imagePath, 800) }} style={[s.hero, { aspectRatio: aspect }]} contentFit="cover" />
          <View style={s.zoomBadge}>
            <Ionicons name="expand-outline" size={16} color="#fff" />
          </View>
        </Pressable>

        <View style={s.content}>
          {d.title ? <Text style={s.title}>{d.title}</Text> : null}
          {d.saveCount > 0 ? (
            <View style={s.savesRow}>
              <Ionicons name="heart" size={13} color="#E5484D" />
              <Text style={s.savesText}>{d.saveCount} {d.saveCount === 1 ? "save" : "saves"}</Text>
            </View>
          ) : null}
          {d.styleSlugs.length > 0 && (
            <View style={s.tags}>
              {d.styleSlugs.map((sl) => <View key={sl} style={s.tag}><Text style={s.tagText}>{sl}</Text></View>)}
            </View>
          )}

          {artist ? (
            <Pressable style={s.artistRow} onPress={() => router.push(`/artist/${artist.id}`)} accessibilityRole="button" accessibilityLabel={`View ${artist.displayName}'s profile`}>
              <Avatar path={artist.avatarPath} name={artist.displayName} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.artistName}>{artist.displayName}</Text>
                <Text style={s.artistMeta} numberOfLines={1}>{artist.headline ?? "Tattoo artist"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D4D4D8" />
            </Pressable>
          ) : null}

          {/* Actions */}
          <View style={s.actions}>
            <Pressable
              style={[s.actionBtn, save.saved && s.actionBtnActive]}
              onPress={onToggleSave}
              disabled={save.isToggling}
              accessibilityRole="button"
              accessibilityState={{ selected: save.saved }}
              accessibilityLabel={save.saved ? "Saved. Tap to remove from your designs" : "Save design"}
            >
              <Ionicons name={save.saved ? "heart" : "heart-outline"} size={20} color={save.saved ? "#E5484D" : "#18181B"} />
              <Text style={[s.actionText, save.saved && { color: "#E5484D" }]}>{save.saved ? "Saved" : "Save"}</Text>
            </Pressable>
          </View>

          {artist ? (
            <Pressable
              style={[s.bookBtn, !artist.isAccepting && s.bookBtnOff]}
              onPress={() => router.push({ pathname: "/booking-request", params: { artistId: artist.id } })}
              disabled={!artist.isAccepting}
              accessibilityRole="button"
              accessibilityLabel={artist.isAccepting ? `Book ${artist.displayName}` : "Artist not accepting bookings"}
            >
              <Text style={s.bookText}>{artist.isAccepting ? `Book ${artist.displayName}` : "Not accepting bookings"}</Text>
            </Pressable>
          ) : null}

          {d.description ? <Text style={s.desc}>{d.description}</Text> : null}

          {/* Similar */}
          <Text style={s.sectionTitle} accessibilityRole="header">Similar designs</Text>
          {similar.isLoading ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : (similar.data ?? []).length === 0 ? (
            <Text style={s.muted}>No similar designs yet.</Text>
          ) : (
            <View style={s.grid}>
              {(similar.data ?? []).map((it: IdeaCard) => (
                <Pressable
                  key={it.id}
                  style={s.gridItem}
                  onPress={() => router.push(`/idea/${it.id}`)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={it.title ? `View design: ${it.title}` : "View design"}
                >
                  <Image source={{ uri: imageUrl(it.imagePath, 200) }} style={s.gridImg} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <ImageZoomModal
        visible={zoom}
        uri={imageUrl(d.imagePath, 1600) ?? ""}
        onClose={() => setZoom(false)}
        label={d.title ?? "Tattoo design"}
      />
    </SafeAreaView>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.topbar}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color="#18181B" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { paddingHorizontal: 12, paddingVertical: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA" },
  body: { paddingBottom: 40 },
  hero: { width: "100%", backgroundColor: "#E4E4E7", maxHeight: 520 },
  zoomBadge: { position: "absolute", right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "800" },
  savesRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: -4 },
  savesText: { color: "#71717A", fontSize: 13, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: "600", color: "#18181B" },
  artistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#F4F4F5" },
  artistName: { fontWeight: "800", fontSize: 15 },
  artistMeta: { color: "#71717A", fontSize: 13, marginTop: 2 },
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 14, paddingVertical: 14 },
  actionBtnActive: { borderColor: "#E5484D", backgroundColor: "#FEF2F2" },
  actionText: { fontWeight: "700", fontSize: 14, color: "#18181B" },
  bookBtn: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  bookBtnOff: { backgroundColor: "#D4D4D8" },
  bookText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  desc: { color: "#3F3F46", lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "48%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#E4E4E7" },
  gridImg: { width: "100%", height: "100%" },
});
