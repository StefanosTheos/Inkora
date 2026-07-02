import { getPreviewSignedUrl } from "@inkora/data-access";
import { AI_PREVIEW_STATUS_LABEL, type AiPreviewStatus } from "@inkora/domain";
import { Image, type ImageStyle } from "expo-image";
import { useEffect, useState } from "react";
import { type StyleProp, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

const TONE: Record<AiPreviewStatus, { bg: string; fg: string }> = {
  draft: { bg: "#F4F4F5", fg: "#52525B" },
  queued: { bg: "#FEF3C7", fg: "#92400E" },
  processing: { bg: "#DBEAFE", fg: "#1E40AF" },
  completed: { bg: "#DCFCE7", fg: "#166534" },
  failed: { bg: "#FEE2E2", fg: "#991B1B" },
};

export function AiStatusChip({ status }: { status: AiPreviewStatus }) {
  const t = TONE[status];
  return (
    <View style={[cs.chip, { backgroundColor: t.bg }]}>
      <Text style={[cs.chipText, { color: t.fg }]}>{AI_PREVIEW_STATUS_LABEL[status]}</Text>
    </View>
  );
}

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
  chip: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  fallback: { backgroundColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
});
