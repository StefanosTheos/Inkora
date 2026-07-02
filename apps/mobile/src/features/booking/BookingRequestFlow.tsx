import { Ionicons } from "@expo/vector-icons";
import {
  bookingKeys, createBookingRequest, publicStorageUrl, uploadBookingReference, useArtistAvailability,
  useArtistProfile, useStudioProfile, useStudioRosterAvailability,
} from "@inkora/data-access";
import { useAuth } from "@inkora/data-access";
import { type ArtistId, type BookingRequestInput, DAY_LABELS, type StudioRosterArtist } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { analytics } from "../../lib/analytics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { MonthCalendar } from "./components/MonthCalendar";
import { fmtDate, money } from "./components/ui";

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);
const PLACEMENTS = ["Forearm", "Upper arm", "Leg", "Back", "Chest", "Ribs", "Hand", "Neck", "Other"];
const SIZES = ["XS (< 5cm)", "S (5–10cm)", "M (10–20cm)", "L (20cm+)"];
const daysLabel = (days: number[]) => (days.length ? days.map((d) => DAY_LABELS[d]).join(" · ") : "By appointment");

export function BookingRequestFlow({ artistId, studioSlug, presetTitle }: { artistId?: string; studioSlug?: string; presetTitle?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const isStudio = !!studioSlug;

  const studioQ = useStudioProfile(supabase, studioSlug ?? "");
  const studio = studioQ.data;
  const roster = studio?.roster ?? [];
  const rosterIds = useMemo(() => roster.map((r) => r.id), [roster]);
  const rosterAvailQ = useStudioRosterAvailability(supabase, rosterIds);
  const rosterAvail = rosterAvailQ.data ?? {};

  // null in studio mode = "let the studio choose" (routes to the studio owner)
  const [chosenArtist, setChosenArtist] = useState<string | null>(null);
  const effectiveArtistId = isStudio ? (chosenArtist ?? studio?.ownerId ?? "") : (artistId ?? "");

  const profileQ = useArtistProfile(supabase, effectiveArtistId);
  const availabilityQ = useArtistAvailability(supabase, effectiveArtistId);
  const currency = profileQ.data?.currencyCode ?? "EUR";

  const STEPS = isStudio
    ? ["Artist", "Idea", "Details", "When", "Budget", "Review"]
    : ["Idea", "Details", "When", "Budget", "Review"];

  const enabledWeekdays = useMemo(() => {
    if (isStudio && !chosenArtist) return Array.from(new Set(Object.values(rosterAvail).flat()));
    return Array.from(new Set((availabilityQ.data ?? []).map((a) => a.dayOfWeek)));
  }, [isStudio, chosenArtist, rosterAvail, availabilityQ.data]);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(presetTitle ?? "");
  const [description, setDescription] = useState("");
  const [placement, setPlacement] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [isColor, setIsColor] = useState<boolean | null>(null);
  const [preferredDate, setPreferredDate] = useState<string | null>(null);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [refs, setRefs] = useState<{ uri: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const cur = STEPS[step];
  const canNext = cur === "Idea" ? title.trim().length > 0 : true;
  const chosenArtistName = chosenArtist ? roster.find((r) => r.id === chosenArtist)?.displayName : null;

  async function addReference() {
    const targetId = effectiveArtistId;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsMultipleSelection: true, selectionLimit: 4 });
    if (res.canceled) return;
    setUploading(true);
    try {
      for (const asset of res.assets) {
        const buf = await (await fetch(asset.uri)).arrayBuffer();
        const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
        const path = await uploadBookingReference(supabase, targetId, buf, asset.mimeType ?? "image/jpeg", ext);
        setRefs((r) => [...r, { uri: asset.uri, path }]);
      }
    } catch (e) {
      Alert.alert("Upload failed", (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!effectiveArtistId) { Alert.alert("Please choose an option", "Pick an artist or let the studio decide."); return; }
    setSubmitting(true);
    try {
      const input: BookingRequestInput = {
        artistId: effectiveArtistId as BookingRequestInput["artistId"],
        studioId: (isStudio ? studio?.id : undefined) as BookingRequestInput["studioId"],
        title: title.trim(),
        description: description.trim() || null,
        placement,
        approxSize: size,
        isColor,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        preferredDate,
        referencePaths: refs.map((r) => r.path),
      };
      const id = await createBookingRequest(supabase, input);
      analytics.capture(
        { name: "booking_requested", props: { artistId: effectiveArtistId as ArtistId, hasReference: refs.length > 0, budgetSet: !!(budgetMin || budgetMax) } },
        ctx,
      );
      await qc.invalidateQueries({ queryKey: bookingKeys.clientRequests });
      router.replace(`/booking/${id}`);
    } catch (e) {
      Alert.alert("Could not send request", (e as Error).message);
      setSubmitting(false);
    }
  }

  if (isStudio ? studioQ.isLoading : profileQ.isLoading) {
    return <View style={s.center}><ActivityIndicator /></View>;
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="close" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle}>{isStudio ? studio?.name ?? "Request booking" : "Request booking"}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={s.progress}>
        {STEPS.map((label, i) => (
          <View key={label} style={s.progressItem}><View style={[s.progressBar, i <= step && s.progressBarActive]} /></View>
        ))}
      </View>
      <Text style={s.stepLabel}>Step {step + 1} of {STEPS.length} · {cur}</Text>

      <ScrollView style={s.flex} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {cur === "Artist" && (
          <>
            <Text style={s.q}>Who would you like?</Text>
            <ArtistOption
              selected={chosenArtist === null}
              onPress={() => setChosenArtist(null)}
              title="Let the studio choose"
              subtitle="They’ll match you with the best available artist"
              icon="sparkles"
            />
            {roster.map((r) => (
              <RosterOption
                key={r.id}
                artist={r}
                days={rosterAvail[r.id] ?? []}
                selected={chosenArtist === r.id}
                onPress={() => setChosenArtist(r.id)}
              />
            ))}
          </>
        )}

        {cur === "Idea" && (
          <>
            <Text style={s.q}>What do you want to get?</Text>
            <TextInput style={s.input} placeholder="e.g. Fine-line wildflower on forearm" value={title} onChangeText={setTitle} />
            <Text style={s.q}>Describe your idea</Text>
            <TextInput style={[s.input, s.multiline]} placeholder="Style, meaning, any must-haves…" value={description} onChangeText={setDescription} multiline />
          </>
        )}

        {cur === "Details" && (
          <>
            <Text style={s.q}>Placement</Text>
            <ChipRow options={PLACEMENTS} value={placement} onChange={setPlacement} />
            <Text style={s.q}>Approx. size</Text>
            <ChipRow options={SIZES} value={size} onChange={setSize} />
            <Text style={s.q}>Color</Text>
            <View style={s.row}>
              <Chip label="Black & grey" active={isColor === false} onPress={() => setIsColor(false)} />
              <Chip label="Color" active={isColor === true} onPress={() => setIsColor(true)} />
            </View>
          </>
        )}

        {cur === "When" && (
          <>
            <Text style={s.q}>Preferred date</Text>
            <Text style={s.hint}>Shaded days reflect availability. You can skip this — they’ll propose a time.</Text>
            <MonthCalendar
              selected={preferredDate}
              onSelect={(d) => setPreferredDate(d === preferredDate ? null : d)}
              enabledWeekdays={enabledWeekdays.length ? enabledWeekdays : undefined}
            />
            {preferredDate ? <Text style={s.selectedDate}>Preferred: {fmtDate(preferredDate)}</Text> : null}
          </>
        )}

        {cur === "Budget" && (
          <>
            <Text style={s.q}>Budget (optional)</Text>
            <View style={s.row}>
              <TextInput style={[s.input, s.flex1]} placeholder={`Min (${currency})`} keyboardType="number-pad" value={budgetMin} onChangeText={setBudgetMin} />
              <TextInput style={[s.input, s.flex1]} placeholder={`Max (${currency})`} keyboardType="number-pad" value={budgetMax} onChangeText={setBudgetMax} />
            </View>
            <Text style={s.q}>Reference photos</Text>
            <View style={s.refGrid}>
              {refs.map((r) => <Image key={r.path} source={{ uri: r.uri }} style={s.refImg} contentFit="cover" />)}
              <Pressable style={s.addRef} onPress={addReference} disabled={uploading}>
                {uploading ? <ActivityIndicator /> : <Ionicons name="add" size={28} color="#71717A" />}
              </Pressable>
            </View>
          </>
        )}

        {cur === "Review" && (
          <>
            <Text style={s.q}>Review</Text>
            {isStudio ? <SummaryRow label="Studio" value={studio?.name ?? "—"} /> : null}
            {isStudio ? <SummaryRow label="Artist" value={chosenArtistName ?? "Studio’s choice"} /> : <SummaryRow label="Artist" value={profileQ.data?.displayName ?? "—"} />}
            <SummaryRow label="Idea" value={title || "—"} />
            {description ? <SummaryRow label="Notes" value={description} /> : null}
            {placement ? <SummaryRow label="Placement" value={placement} /> : null}
            {size ? <SummaryRow label="Size" value={size} /> : null}
            {isColor != null ? <SummaryRow label="Color" value={isColor ? "Color" : "Black & grey"} /> : null}
            <SummaryRow label="Preferred date" value={preferredDate ? fmtDate(preferredDate) : "Flexible"} />
            <SummaryRow label="Budget" value={budgetMin || budgetMax ? `${money(budgetMin ? Number(budgetMin) : null, currency)} – ${money(budgetMax ? Number(budgetMax) : null, currency)}` : "Open"} />
            <SummaryRow label="References" value={refs.length ? `${refs.length} photo${refs.length > 1 ? "s" : ""}` : "None"} />
          </>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {step > 0 && (
          <Pressable style={s.back} onPress={() => setStep((v) => v - 1)}><Text style={s.backText}>Back</Text></Pressable>
        )}
        {step < STEPS.length - 1 ? (
          <Pressable style={[s.next, !canNext && s.disabled]} disabled={!canNext} onPress={() => setStep((v) => v + 1)}>
            <Text style={s.nextText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={[s.next, submitting && s.disabled]} disabled={submitting} onPress={submit}>
            <Text style={s.nextText}>{submitting ? "Sending…" : "Send request"}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function ArtistOption({ selected, onPress, title, subtitle, icon }: { selected: boolean; onPress: () => void; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable style={[s.optionCard, selected && s.optionCardActive]} onPress={onPress}>
      <View style={s.optionIcon}><Ionicons name={icon} size={20} color="#E5484D" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSub}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? "#E5484D" : "#D4D4D8"} />
    </Pressable>
  );
}

function RosterOption({ artist, days, selected, onPress }: { artist: StudioRosterArtist; days: number[]; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.optionCard, selected && s.optionCardActive]} onPress={onPress}>
      <View style={s.optionAvatar}>
        {img(artist.avatarPath) ? <Image source={{ uri: img(artist.avatarPath) }} style={s.optionAvatarImg} contentFit="cover" /> : (
          <Text style={s.optionAvatarInitial}>{artist.displayName.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{artist.displayName}</Text>
        {artist.styles.length > 0 ? <Text style={s.optionSub} numberOfLines={1}>{artist.styles.slice(0, 3).join(" · ")}</Text> : null}
        <Text style={s.optionAvail}>🗓 {daysLabel(days)}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? "#E5484D" : "#D4D4D8"} />
    </Pressable>
  );
}

function ChipRow({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <View style={s.chipWrap}>
      {options.map((o) => <Chip key={o} label={o} active={value === o} onPress={() => onChange(value === o ? null : o)} />)}
    </View>
  );
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 16, marginTop: 4 },
  progressItem: { flex: 1 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: "#E4E4E7" },
  progressBarActive: { backgroundColor: "#E5484D" },
  stepLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "600", paddingHorizontal: 16, marginTop: 8 },
  body: { padding: 16, gap: 8, paddingBottom: 32 },
  q: { fontSize: 16, fontWeight: "800", marginTop: 12 },
  hint: { color: "#71717A", fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginTop: 6 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10, marginTop: 6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  chipText: { fontWeight: "600", color: "#18181B", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  selectedDate: { marginTop: 10, fontWeight: "700", color: "#E5484D" },
  refGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  refImg: { width: 76, height: 76, borderRadius: 12 },
  addRef: { width: 76, height: 76, borderRadius: 12, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 16, padding: 12, marginTop: 10 },
  optionCardActive: { borderColor: "#E5484D", backgroundColor: "#FEF2F2" },
  optionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  optionAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  optionAvatarImg: { width: "100%", height: "100%" },
  optionAvatarInitial: { color: "#fff", fontWeight: "800", fontSize: 18 },
  optionTitle: { fontWeight: "800", fontSize: 15 },
  optionSub: { color: "#71717A", fontSize: 13, marginTop: 2 },
  optionAvail: { color: "#52525B", fontSize: 12, marginTop: 4, fontWeight: "600" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  summaryLabel: { color: "#71717A", fontWeight: "600" },
  summaryValue: { flex: 1, textAlign: "right", fontWeight: "600", color: "#18181B" },
  footer: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  back: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  backText: { fontWeight: "700", color: "#18181B" },
  next: { flex: 1, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.4 },
});
