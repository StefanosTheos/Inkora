import { getPreviewSignedUrl } from "@inkora/data-access";
import { Image, type ImageStyle } from "expo-image";
import { useEffect, useState } from "react";
import { type StyleProp, StyleSheet, View } from "react-native";

import { supabase } from "../../lib/supabase";

/** Renders a private ai-previews image via a signed URL (source photo). */
export function SignedPreviewImage({ path, style }: { path: string | null; style?: StyleProp<ImageStyle> }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let ok = true;
    if (path) void getPreviewSignedUrl(supabase, path).then((u) => ok && setUrl(u ?? undefined));
    return () => { ok = false; };
  }, [path]);
  if (!path || !url) return <View style={[style, cs.fallback]} />;
  return <Image source={{ uri: url }} style={style} contentFit="cover" />;
}

const cs = StyleSheet.create({
  fallback: { backgroundColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
});
