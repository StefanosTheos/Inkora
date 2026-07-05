// Route: /image-viewer?path=<storage path>&title=… — fullscreen zoomable image.
import { publicStorageUrl } from "@inkora/data-access";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ZoomableImage } from "../../src/components/ImageZoomModal";
import { env } from "../../src/lib/env";

export default function ImageViewerModal() {
  const router = useRouter();
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const uri = path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined;
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {uri ? (
        <ZoomableImage uri={uri} label={title || "Saved design"} onRequestClose={() => router.back()} />
      ) : (
        <View style={s.center}><Text style={s.missing}>Image unavailable</Text></View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  missing: { color: "#fff" },
});
