// Route: /image-viewer?path=<storage path>&title=… — fullscreen image.
import { Ionicons } from "@expo/vector-icons";
import { publicStorageUrl } from "@inkora/data-access";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { env } from "../../src/lib/env";

export default function ImageViewerModal() {
  const router = useRouter();
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const uri = path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined;
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <Pressable style={s.close} onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>
      {uri ? <Image source={{ uri }} style={s.img} contentFit="contain" /> : <Text style={s.missing}>Image unavailable</Text>}
      {title ? <Text style={s.title}>{title}</Text> : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", top: 48, right: 16, zIndex: 2, padding: 6 },
  img: { width: "100%", height: "80%" },
  missing: { color: "#fff" },
  title: { color: "#fff", fontWeight: "600", padding: 16, textAlign: "center" },
});
