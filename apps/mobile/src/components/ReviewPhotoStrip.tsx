import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { imageUrl } from "../lib/images";
import { ImageZoomModal } from "./ImageZoomModal";

/** Horizontal strip of a review's tattoo journey/progress photos. Each tile
 *  opens the full pinch-to-zoom viewer. Renders nothing when there are none. */
export function ReviewPhotoStrip({ paths }: { paths: string[] }) {
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  if (!paths.length) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {paths.map((p, i) => (
          <Pressable
            key={`${p}-${i}`}
            onPress={() => setZoomUri(imageUrl(p, 1200) ?? null)}
            accessibilityRole="imagebutton"
            accessibilityLabel="View progress photo"
          >
            <Image source={{ uri: imageUrl(p, 128) }} style={s.thumb} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri ?? ""} onClose={() => setZoomUri(null)} label="Tattoo progress" />
    </>
  );
}

const s = StyleSheet.create({
  row: { gap: 8, paddingTop: 10 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#E4E4E7" },
});
