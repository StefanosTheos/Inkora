// Route: /image-viewer?id=<savedDesignId>
// Fullscreen, swipeable gallery of the user's saved designs: pinch-to-zoom each,
// swipe left/right to move between them, and a per-design shortcut to start a
// booking with it as a reference. Reads the same useSavedDesigns cache the
// dashboard populated, so only the starting design's id is passed.
import { Ionicons } from "@expo/vector-icons";
import { publicStorageUrl, useSavedDesigns } from "@inkora/data-access";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ZoomableImage } from "../../src/components/ImageZoomModal";
import { env } from "../../src/lib/env";
import { imageUrl } from "../../src/lib/images";
import { supabase } from "../../src/lib/supabase";

export default function ImageViewerModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const designs = useSavedDesigns(supabase).data ?? [];
  const { width } = useWindowDimensions();
  // This modal is its own (modals) stack, so a plain back() has nothing to pop;
  // navigate absolutely back to the dashboard it was opened from.
  const close = () => router.navigate("/profile");

  const startIndex = Math.max(0, designs.findIndex((d) => d.id === id));
  const [zoomed, setZoomed] = useState(false);
  const [index, setIndex] = useState(startIndex);
  // Each horizontal page needs a definite height for the (flex:1) zoom surface;
  // measure the list's height rather than assume the full window (modal cards
  // aren't full-height on iOS).
  const [listH, setListH] = useState(0);

  if (designs.length === 0) {
    return <SafeAreaView style={s.safe} edges={["top", "bottom"]}><View style={s.center}><Text style={s.missing}>Image unavailable</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <FlatList
        data={designs}
        horizontal
        pagingEnabled
        // While an image is zoomed, panning should win over swipe-to-next.
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(d) => d.id}
        initialScrollIndex={startIndex}
        onLayout={(e) => setListH(e.nativeEvent.layout.height)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => {
          // Request a screen-width variant (imageUrl applies the @2x factor and a
          // quality cap) instead of the full-res original — plenty for a
          // fullscreen zoomable view without the bandwidth/memory cost.
          const uri = imageUrl(item.imagePath, width) ?? publicStorageUrl(env.SUPABASE_URL, item.imagePath);
          return (
            <View style={{ width, height: listH || undefined }}>
              <ZoomableImage uri={uri} label={item.title || "Saved design"} onRequestClose={close} onZoomChange={setZoomed} tapToClose={false} />
              {item.artistId ? (
                <View style={s.footer} pointerEvents="box-none">
                  {item.artistName ? <Text style={s.artist} numberOfLines={1}>By {item.artistName}</Text> : null}
                  {item.isFlash ? (
                    <Pressable
                      style={s.tryOnBtn}
                      onPress={() => router.push({ pathname: "/create/new", params: { flashPath: item.imagePath, flashId: item.id, artistName: item.artistName ?? "Artist", caption: item.title ?? "" } })}
                      accessibilityRole="button"
                      accessibilityLabel="Try this design on you"
                    >
                      <Ionicons name="sparkles-outline" size={18} color="#fff" />
                      <Text style={s.tryOnText}>Try on you</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={s.bookBtn}
                    onPress={() => router.push({ pathname: "/booking-request", params: { artistId: item.artistId ?? "", refPath: item.imagePath } })}
                    accessibilityRole="button"
                    accessibilityLabel="Request a booking with this design as a reference"
                  >
                    <Ionicons name="calendar-outline" size={18} color="#fff" />
                    <Text style={s.bookText}>Request booking with this design</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />
      {designs.length > 1 ? (
        <View style={s.counter} pointerEvents="none"><Text style={s.counterText}>{index + 1} / {designs.length}</Text></View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  missing: { color: "#fff" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, gap: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  artist: { color: "#fff", fontSize: 15, fontWeight: "700" },
  bookBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 14 },
  bookText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  tryOnBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.75)", borderRadius: 14, paddingVertical: 12.5 },
  tryOnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  counter: { position: "absolute", top: 52, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  counterText: { color: "#fff", fontWeight: "700", fontSize: 13, fontVariant: ["tabular-nums"] },
});
