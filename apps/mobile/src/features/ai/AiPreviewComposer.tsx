import { Ionicons } from "@expo/vector-icons";
import { aiKeys, createAiPreview, uploadPreviewSource } from "@inkora/data-access";
import { AI_PLACEMENTS, AI_PREVIEW_DISCLAIMER, type AiPreviewInput } from "@inkora/domain";
import { MOCK_PREVIEW_EXAMPLES } from "@inkora/ai";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";

const STYLES = MOCK_PREVIEW_EXAMPLES.map((e) => ({ slug: e.styleSlug, label: e.label }));

export function AiPreviewComposer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [placement, setPlacement] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    setPhotoUri(res.assets[0].uri);
  }

  async function generate() {
    if (!photoUri) { toast.show("Upload a photo of where you want the tattoo", "error"); return; }
    setSubmitting(true);
    try {
      // Upload the source photo (private bucket). NO generation happens.
      const buf = await (await fetch(photoUri)).arrayBuffer();
      const sourceImagePath = await uploadPreviewSource(supabase, buf, "image/jpeg", "jpg");
      // TODO(ai): the real flow enqueues generation via the AiPreviewService
      // boundary; here we only persist the request (status 'queued').
      const input: AiPreviewInput = {
        sourceImagePath,
        prompt: [prompt.trim(), style ? `Style: ${style}` : null].filter(Boolean).join(" · ") || undefined,
        placement: placement ?? undefined,
      };
      const preview = await createAiPreview(supabase, input);
      await qc.invalidateQueries({ queryKey: aiKeys.list });
      router.replace(`/create/${preview.id}`);
    } catch (e) {
      toast.show((e as Error).message, "error");
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle}>New preview</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.q}>Your photo</Text>
        <Text style={s.hint}>Upload the body area where you’d like to see the tattoo.</Text>
        <Pressable style={s.photoBox} onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photo} contentFit="cover" />
          ) : (
            <View style={s.photoEmpty}>
              <Ionicons name="camera-outline" size={30} color="#71717A" />
              <Text style={s.photoEmptyText}>Tap to add a photo</Text>
            </View>
          )}
        </Pressable>

        <Text style={s.q}>Describe the tattoo</Text>
        <TextInput style={[s.input, s.multiline]} placeholder="e.g. a small fine-line wildflower" value={prompt} onChangeText={setPrompt} multiline />

        <Text style={s.q}>Style</Text>
        <View style={s.chipWrap}>
          {STYLES.map((st) => <Chip key={st.slug} label={st.slug} active={style === st.slug} onPress={() => setStyle(style === st.slug ? null : st.slug)} />)}
        </View>

        <Text style={s.q}>Placement</Text>
        <View style={s.chipWrap}>
          {AI_PLACEMENTS.map((pl) => <Chip key={pl} label={pl} active={placement === pl} onPress={() => setPlacement(placement === pl ? null : pl)} />)}
        </View>

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={16} color="#92400E" />
          <Text style={s.noteText}>{AI_PREVIEW_DISCLAIMER}</Text>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={[s.generate, (submitting || !photoUri) && s.disabled]} disabled={submitting || !photoUri} onPress={generate}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.generateText}>✨ Generate preview</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  body: { padding: 16, paddingBottom: 32 },
  q: { fontSize: 16, fontWeight: "800", marginTop: 16 },
  hint: { color: "#71717A", fontSize: 13, marginTop: 2, marginBottom: 8 },
  photoBox: { borderRadius: 16, overflow: "hidden", backgroundColor: "#F4F4F5", height: 220, marginTop: 4 },
  photo: { width: "100%", height: "100%" },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  photoEmptyText: { color: "#71717A", fontWeight: "600" },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginTop: 8 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  chipText: { fontWeight: "600", color: "#18181B", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  note: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginTop: 20 },
  noteText: { flex: 1, color: "#92400E", fontSize: 12, fontWeight: "600" },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  generate: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  generateText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.4 },
});
