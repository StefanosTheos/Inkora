import { Ionicons } from "@expo/vector-icons";
import type { PortfolioCard } from "@inkora/data-access";
import { startDirectConversation, useAuth, useMoreFromArtist, usePortfolioDesign, usePortfolioSaved } from "@inkora/data-access";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ImageZoomModal } from "../../components/ImageZoomModal";
import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../booking/components/ui";

export function PortfolioDesignScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { ctx } = useAuth();
  // Save / Try-on / Request-booking are client actions — hidden for the studio
  // owner, who browses designs but books nothing.
  const isStudioOwner = ctx.roles.includes("studio_admin");
  const detail = usePortfolioDesign(supabase, id);
  const save = usePortfolioSaved(supabase, id);
  const [zoom, setZoom] = useState(false);

  const d = detail.data;
  const more = useMoreFromArtist(supabase, d?.artist?.id ?? "", id);

  if (detail.isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }
  if (!d) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <TopBar onBack={() => router.back()} />
        <View style={s.center}><Text style={s.muted}>This design is no longer available.</Text></View>
      </SafeAreaView>
    );
  }

  const artist = d.artist;
  const canMessage = !!artist && (ctx.userId as string | null) !== (artist.id as string);

  const onToggleSave = () => {
    const next = !save.saved;
    save.toggle();
    toast.show(next ? "Saved to your designs" : "Removed from saved");
  };

  async function onShare() {
    try {
      const url = imageUrl(d?.imagePath) ?? "";
      const line = `Check out this tattoo design${d?.caption ? ` "${d.caption}"` : ""}${artist ? ` by ${artist.displayName}` : ""} on Inkora`;
      await Share.share({ message: [line, url].filter(Boolean).join("\n") });
    } catch { /* user dismissed the share sheet */ }
  }

  async function messageArtist() {
    if (!artist) return;
    try {
      const cid = await startDirectConversation(supabase, artist.id);
      router.push(`/chats/${cid}`);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar onBack={() => router.back()} onShare={() => void onShare()} />
      <ScrollView contentContainerStyle={s.body}>
        <Pressable onPress={() => setZoom(true)} accessibilityRole="imagebutton" accessibilityLabel={`${d.caption ?? "Tattoo design"}. Tap to zoom`}>
          <Image source={{ uri: imageUrl(d.imagePath, 800) }} style={s.hero} contentFit="cover" />
          <View style={s.zoomBadge}>
            <Ionicons name="expand-outline" size={16} color="#fff" />
          </View>
        </Pressable>

        <View style={s.content}>
          {d.caption ? <Text style={s.title}>{d.caption}</Text> : null}
          {d.placement ? (
            <View style={s.tags}>
              <View style={s.tag}><Text style={s.tagText}>{d.placement}</Text></View>
            </View>
          ) : null}

          {artist ? (
            <View style={s.artistRow}>
              <Pressable style={s.artistInfo} onPress={() => router.push(`/artist/${artist.id}`)} accessibilityRole="button" accessibilityLabel={`View ${artist.displayName}'s profile`}>
                <Avatar path={artist.avatarPath} name={artist.displayName} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.artistName}>{artist.displayName}</Text>
                  <Text style={s.artistMeta} numberOfLines={1}>{artist.headline ?? "Tattoo artist"}</Text>
                </View>
              </Pressable>
              {canMessage ? (
                <Pressable style={s.msgBtn} onPress={() => void messageArtist()} accessibilityRole="button" accessibilityLabel={`Message ${artist.displayName}`}>
                  <Ionicons name="chatbubble-outline" size={18} color="#18181B" />
                </Pressable>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#D4D4D8" />
              )}
            </View>
          ) : null}

          {/* Client actions — hidden for studio owners (business account). */}
          {!isStudioOwner ? (
            <>
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

                {/* Try-on is a flash-only feature (clean line art composites cleanly). */}
                {d.kind === "flash" ? (
                  <Pressable
                    style={s.actionBtn}
                    onPress={() => router.push({ pathname: "/create/new", params: { flashPath: d.imagePath, flashId: d.id, artistName: artist?.displayName ?? "", caption: d.caption ?? "" } })}
                    accessibilityRole="button"
                    accessibilityLabel="Try this design on you"
                  >
                    <Ionicons name="sparkles-outline" size={20} color="#18181B" />
                    <Text style={s.actionText}>Try on you</Text>
                  </Pressable>
                ) : null}
              </View>

              {artist ? (
                <Pressable
                  style={[s.bookBtn, !artist.isAccepting && s.bookBtnOff]}
                  onPress={() => router.push({ pathname: "/booking-request", params: { artistId: artist.id, refPath: d.imagePath } })}
                  disabled={!artist.isAccepting}
                  accessibilityRole="button"
                  accessibilityLabel={artist.isAccepting ? "Request a booking with this design as a reference" : "Artist not accepting bookings"}
                >
                  <Text style={s.bookText}>{artist.isAccepting ? "Request booking with this design" : "Not accepting bookings"}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {/* More from this artist */}
          <Text style={s.sectionTitle} accessibilityRole="header">More from this artist</Text>
          {more.isLoading ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : (more.data ?? []).length === 0 ? (
            <Text style={s.muted}>No other pieces yet.</Text>
          ) : (
            <View style={s.grid}>
              {(more.data ?? []).map((it: PortfolioCard) => (
                <Pressable
                  key={it.id}
                  style={s.gridItem}
                  onPress={() => router.push(`/portfolio/${it.id}`)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={it.caption ? `View design: ${it.caption}` : "View design"}
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
        label={d.caption ?? "Tattoo design"}
      />
    </SafeAreaView>
  );
}

function TopBar({ onBack, onShare }: { onBack: () => void; onShare?: () => void }) {
  return (
    <View style={s.topbar}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color="#18181B" />
      </Pressable>
      {onShare ? (
        <Pressable onPress={onShare} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share this design">
          <Ionicons name="share-outline" size={23} color="#18181B" />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA" },
  body: { paddingBottom: 40 },
  hero: { width: "100%", aspectRatio: 1, backgroundColor: "#E4E4E7", maxHeight: 520 },
  zoomBadge: { position: "absolute", right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "800" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: "600", color: "#18181B" },
  artistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#F4F4F5" },
  artistInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  msgBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  artistName: { fontWeight: "800", fontSize: 15 },
  artistMeta: { color: "#71717A", fontSize: 13, marginTop: 2 },
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 14, paddingVertical: 14 },
  actionBtnActive: { borderColor: "#E5484D", backgroundColor: "#FEF2F2" },
  actionText: { fontWeight: "700", fontSize: 14, color: "#18181B" },
  bookBtn: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  bookBtnOff: { backgroundColor: "#D4D4D8" },
  bookText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridItem: { width: "48%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#E4E4E7" },
  gridImg: { width: "100%", height: "100%" },
});
