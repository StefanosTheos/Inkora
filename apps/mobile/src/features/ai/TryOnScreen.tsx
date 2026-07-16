import { Ionicons } from "@expo/vector-icons";
import { aiKeys, type FlashListItem, saveTattooTryOn, uploadTryOnResult, useFlashes } from "@inkora/data-access";
import { AI_PLACEMENTS, AI_PREVIEW_DISCLAIMER, type PortfolioImageId } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, type DimensionValue, type LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { type CompositorHandle, TattooCompositor } from "./TattooCompositor";

type Flash = { id: string; path: string; caption: string | null; artistName: string };

export function TryOnScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ flashId?: string; flashPath?: string; artistName?: string; caption?: string }>();

  const initialFlash: Flash | null = params.flashPath
    ? { id: String(params.flashId ?? ""), path: String(params.flashPath), caption: params.caption ?? null, artistName: params.artistName ?? "Artist" }
    : null;

  const [flash, setFlash] = useState<Flash | null>(initialFlash);
  const [bodyUri, setBodyUri] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.9);
  const [placement, setPlacement] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const compRef = useRef<CompositorHandle>(null);

  async function pick(fromCamera: boolean) {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { toast.show("Camera permission is needed to take a photo", "error"); return; }
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!res.canceled && res.assets[0]) setBodyUri(res.assets[0].uri);
  }

  async function save() {
    const bytes = compRef.current?.capture();
    if (!bytes) { toast.show("Give it a moment to render, then try again", "error"); return; }
    setSaving(true);
    try {
      const resultPath = await uploadTryOnResult(supabase, bytes);
      const preview = await saveTattooTryOn(supabase, {
        resultImagePath: resultPath,
        sourceFlashId: flash?.id ? (flash.id as PortfolioImageId) : undefined,
        placement: placement ?? undefined,
        note: flash?.caption ?? flash?.artistName,
      });
      await qc.invalidateQueries({ queryKey: aiKeys.list });
      router.replace(`/create/${preview.id}`);
    } catch (e) {
      toast.show((e as Error).message, "error");
      setSaving(false);
    }
  }

  // ---- Step 1: pick a flash ----
  if (!flash) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <Header title="Try a design on" onBack={() => router.back()} />
        <FlashPicker onPick={(f) => setFlash({ id: f.id, path: f.imagePath, caption: f.caption, artistName: f.artistName })} />
      </SafeAreaView>
    );
  }

  const flashUrl = imageUrl(flash.path, 1200) ?? "";

  // ---- Step 2: add a body photo ----
  if (!bodyUri) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <Header title="Add your photo" onBack={() => (initialFlash ? router.back() : setFlash(null))} />
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.chosenFlash}>
            <Image source={{ uri: imageUrl(flash.path, 300) ?? undefined }} style={s.chosenFlashImg} contentFit="contain" />
            <Text style={s.chosenFlashText} numberOfLines={1}>{flash.caption ?? `Flash by ${flash.artistName}`}</Text>
          </View>
          <Text style={s.q}>Photograph the spot</Text>
          <Text style={s.hint}>Take or choose a clear, well-lit photo of the body area. Your photo stays on your device — only the mockup you save is stored.</Text>
          <Pressable style={s.bigBtn} onPress={() => void pick(true)} accessibilityRole="button" accessibilityLabel="Take a photo">
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text style={s.bigBtnText}>Take a photo</Text>
          </Pressable>
          <Pressable style={[s.bigBtn, s.bigBtnAlt]} onPress={() => void pick(false)} accessibilityRole="button" accessibilityLabel="Choose from library">
            <Ionicons name="images-outline" size={22} color="#18181B" />
            <Text style={[s.bigBtnText, s.bigBtnAltText]}>Choose from library</Text>
          </Pressable>
          {!initialFlash ? (
            <Pressable style={s.linkBtn} onPress={() => setFlash(null)}><Text style={s.linkText}>← Pick a different design</Text></Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Step 3: compose ----
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Header title="Position the design" onBack={() => setBodyUri(null)} />
      <View style={s.canvasArea}>
        <TattooCompositor ref={compRef} bodyUri={bodyUri} flashUri={flashUrl} opacity={opacity} />
      </View>
      <ScrollView style={s.controls} contentContainerStyle={s.controlsInner} keyboardShouldPersistTaps="handled">
        <Text style={s.gestureHint}>Drag to move · pinch to resize · twist to rotate</Text>
        <View style={s.sliderRow}>
          <Ionicons name="contrast-outline" size={16} color="#71717A" />
          <Slider value={opacity} min={0.3} max={1} onChange={setOpacity} />
          <Text style={s.sliderVal}>{Math.round(opacity * 100)}%</Text>
        </View>
        <Text style={s.placeLabel}>Placement (optional)</Text>
        <View style={s.chipWrap}>
          {AI_PLACEMENTS.map((pl) => (
            <Pressable key={pl} style={[s.chip, placement === pl && s.chipActive]} onPress={() => setPlacement(placement === pl ? null : pl)}>
              <Text style={[s.chipText, placement === pl && s.chipTextActive]}>{pl}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={15} color="#92400E" />
          <Text style={s.noteText}>{AI_PREVIEW_DISCLAIMER}</Text>
        </View>
      </ScrollView>
      <View style={s.footer}>
        <Pressable style={s.secondaryBtn} onPress={() => void pick(bodyUri ? false : true)} accessibilityRole="button" accessibilityLabel="Change photo">
          <Ionicons name="refresh-outline" size={18} color="#18181B" />
          <Text style={s.secondaryText}>Change photo</Text>
        </Pressable>
        <Pressable style={[s.saveBtn, saving && s.disabled]} disabled={saving} onPress={() => void save()} accessibilityRole="button" accessibilityLabel="Save mockup">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save mockup</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function FlashPicker({ onPick }: { onPick: (f: FlashListItem) => void }) {
  const q = useFlashes(supabase);
  const flashes = q.data ?? [];
  if (q.isLoading) return <View style={s.center}><ActivityIndicator /></View>;
  if (flashes.length === 0) return <View style={s.center}><Ionicons name="sparkles-outline" size={36} color="#D4D4D8" /><Text style={s.muted}>No flash designs to try on yet.</Text></View>;
  return (
    <ScrollView contentContainerStyle={s.grid}>
      <Text style={s.pickerHint}>Pick a flash design to see it on you.</Text>
      <View style={s.gridRow}>
        {flashes.map((f) => (
          <Pressable key={f.id} style={s.gridItem} onPress={() => onPick(f)} accessibilityRole="button" accessibilityLabel={f.caption ?? `Flash by ${f.artistName}`}>
            <Image source={{ uri: imageUrl(f.imagePath, 300) ?? undefined }} style={s.gridImg} contentFit="cover" />
            <Text style={s.gridCaption} numberOfLines={1}>{f.caption ?? f.artistName}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Slider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [w, setW] = useState(0);
  const set = (x: number) => { if (w > 0) onChange(min + Math.max(0, Math.min(1, x / w)) * (max - min)); };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
    onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [w]);
  const pct = `${((value - min) / (max - min)) * 100}%` as DimensionValue;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return (
    <View style={s.sliderTrack} onLayout={onLayout} {...pan.panHandlers}>
      <View style={[s.sliderFill, { width: pct }]} />
      <View style={[s.sliderThumb, { left: pct }]} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  muted: { color: "#A1A1AA", textAlign: "center" },
  body: { padding: 16, gap: 12 },
  q: { fontSize: 17, fontWeight: "800", marginTop: 8 },
  hint: { color: "#71717A", fontSize: 13, lineHeight: 19 },
  chosenFlash: { alignItems: "center", gap: 8, backgroundColor: "#F4F4F5", borderRadius: 16, padding: 16 },
  chosenFlashImg: { width: 120, height: 120 },
  chosenFlashText: { color: "#52525B", fontWeight: "600", fontSize: 13 },
  bigBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#18181B", borderRadius: 14, paddingVertical: 15 },
  bigBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  bigBtnAlt: { backgroundColor: "#F4F4F5" },
  bigBtnAltText: { color: "#18181B" },
  linkBtn: { alignItems: "center", paddingVertical: 12 },
  linkText: { color: "#E5484D", fontWeight: "700" },
  // picker
  grid: { padding: 16 },
  pickerHint: { color: "#71717A", fontSize: 14, marginBottom: 12 },
  gridRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  gridItem: { width: "47%", gap: 6 },
  gridImg: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: "#F4F4F5" },
  gridCaption: { fontSize: 12, fontWeight: "600", color: "#52525B" },
  // compose
  canvasArea: { flex: 1, margin: 16, marginBottom: 8 },
  controls: { maxHeight: 210 },
  controlsInner: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  gestureHint: { color: "#A1A1AA", fontSize: 12, fontWeight: "600", textAlign: "center" },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sliderTrack: { flex: 1, height: 28, justifyContent: "center" },
  sliderFill: { position: "absolute", left: 0, height: 6, borderRadius: 3, backgroundColor: "#E5484D" },
  sliderThumb: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", borderWidth: 2, borderColor: "#E5484D", marginLeft: -10, top: 4 },
  sliderVal: { width: 40, textAlign: "right", fontWeight: "700", color: "#18181B", fontSize: 13 },
  placeLabel: { fontSize: 13, fontWeight: "700", color: "#52525B" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipActive: { backgroundColor: "#18181B", borderColor: "#18181B" },
  chipText: { fontWeight: "600", color: "#18181B", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12 },
  noteText: { flex: 1, color: "#92400E", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 14, paddingHorizontal: 16, justifyContent: "center" },
  secondaryText: { fontWeight: "700", color: "#18181B", fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
});
