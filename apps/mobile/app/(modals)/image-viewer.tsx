// Route: /image-viewer?path=<storage path>&title=…&artistId=…&artistName=…
// Snapshot of a saved design: fullscreen zoomable image, artist attribution,
// and a shortcut to start a booking with this design as a reference.
import { Ionicons } from "@expo/vector-icons";
import { publicStorageUrl } from "@inkora/data-access";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ZoomableImage } from "../../src/components/ImageZoomModal";
import { env } from "../../src/lib/env";

export default function ImageViewerModal() {
  const router = useRouter();
  const { path, title, artistId, artistName } = useLocalSearchParams<{ path?: string; title?: string; artistId?: string; artistName?: string }>();
  const uri = path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined;
  // This modal lives in the (modals) stack as its only screen, so a plain
  // back()/dismiss() has nothing to POP (it errors or resets to Home). Navigate
  // absolutely back to the profile dashboard it was opened from instead.
  const close = () => router.navigate("/profile");
  const bookable = !!artistId && !!path;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {uri ? (
        <View style={s.flex}>
          <ZoomableImage uri={uri} label={title || "Saved design"} onRequestClose={close} />
          {bookable ? (
            <View style={s.footer}>
              {artistName ? <Text style={s.artist} numberOfLines={1}>By {artistName}</Text> : null}
              <Pressable
                style={s.bookBtn}
                onPress={() => router.push({ pathname: "/booking-request", params: { artistId, refPath: path } })}
                accessibilityRole="button"
                accessibilityLabel="Request a booking with this design as a reference"
              >
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={s.bookText}>Request booking with this design</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={s.center}><Text style={s.missing}>Image unavailable</Text></View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  missing: { color: "#fff" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, gap: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  artist: { color: "#fff", fontSize: 15, fontWeight: "700" },
  bookBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 14 },
  bookText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
