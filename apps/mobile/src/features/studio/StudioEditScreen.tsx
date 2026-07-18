import { Ionicons } from "@expo/vector-icons";
import { updateStudio, uploadStudioLogo, useAuth, useMyStudio } from "@inkora/data-access";
import { CURRENCY_OPTIONS, currencySymbol, type StudioProfile } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { imageUrl } from "../../lib/images";
import { supabase } from "../../lib/supabase";

const DAYS: [string, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

type Interval = { from: string; to: string };
type DayState = { open: boolean; intervals: Interval[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const maskTime = (v: string): string => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
};
const validTime = (t: string): boolean => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59;
};

export function StudioEditScreen() {
  const router = useRouter();
  const { ctx } = useAuth();
  const studioQ = useMyStudio(supabase, ctx.userId ?? "");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.title}>Edit studio</Text>
        <View style={{ width: 26 }} />
      </View>
      {studioQ.isLoading ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : !studioQ.data ? (
        <View style={s.center}><Text style={s.muted}>No studio found.</Text></View>
      ) : (
        <EditForm studio={studioQ.data} />
      )}
    </SafeAreaView>
  );
}

function EditForm({ studio }: { studio: StudioProfile }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const [name, setName] = useState(studio.name);
  const [bio, setBio] = useState(studio.bio ?? "");
  const [email, setEmail] = useState(studio.email ?? "");
  const [phone, setPhone] = useState(studio.phone ?? "");
  const [website, setWebsite] = useState(studio.website ?? "");
  const [city, setCity] = useState(studio.city ?? "");
  const [address, setAddress] = useState(studio.addressLine ?? "");
  const [currency, setCurrency] = useState(studio.currencyCode || "EUR");
  const [logoPath, setLogoPath] = useState<string | null>(studio.logoPath);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hours, setHours] = useState<Record<string, DayState>>(() => {
    const h: Record<string, DayState> = {};
    for (const [key] of DAYS) {
      // Read EVERY interval, not just the first — split shifts survive an edit.
      const ivs = (studio.openingHours[key] ?? []).map((iv) => ({ from: iv[0] ?? "10:00", to: iv[1] ?? "18:00" }));
      h[key] = ivs.length ? { open: true, intervals: ivs } : { open: false, intervals: [{ from: "10:00", to: "18:00" }] };
    }
    return h;
  });
  const [busy, setBusy] = useState(false);

  const setDayOpen = (key: string, open: boolean) => setHours((p) => ({ ...p, [key]: { ...p[key]!, open } }));
  const setInterval = (key: string, idx: number, patch: Partial<Interval>) =>
    setHours((p) => ({ ...p, [key]: { ...p[key]!, intervals: p[key]!.intervals.map((iv, i) => (i === idx ? { ...iv, ...patch } : iv)) } }));
  const addInterval = (key: string) =>
    setHours((p) => ({ ...p, [key]: { ...p[key]!, intervals: [...p[key]!.intervals, { from: "10:00", to: "18:00" }] } }));
  const removeInterval = (key: string, idx: number) =>
    setHours((p) => {
      const kept = p[key]!.intervals.filter((_, i) => i !== idx);
      return { ...p, [key]: { ...p[key]!, intervals: kept.length ? kept : [{ from: "10:00", to: "18:00" }] } };
    });

  async function pickLogo() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploadingLogo(true);
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      const path = await uploadStudioLogo(supabase, buf, asset.mimeType ?? "image/jpeg", ext);
      setLogoPath(path); // staged; persisted on Save
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function save() {
    if (!name.trim()) { toast.show("Studio name is required", "error"); return; }

    // Contact validation.
    const em = email.trim();
    if (em && !EMAIL_RE.test(em)) { toast.show("Enter a valid email address", "error"); return; }
    const ph = phone.trim();
    if (ph && ph.replace(/\D/g, "").length < 6) { toast.show("Enter a valid phone number", "error"); return; }
    let web = website.trim();
    if (web) {
      if (!/^https?:\/\//i.test(web)) web = `https://${web}`; // tolerate "studio.com"
      if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(web)) { toast.show("Enter a valid website URL", "error"); return; }
    }

    // Opening hours — keep every interval; validate each.
    const openingHours: Record<string, string[][]> = {};
    for (const [key, label] of DAYS) {
      const d = hours[key]!;
      if (!d.open) continue;
      const ivs: string[][] = [];
      for (const iv of d.intervals) {
        if (!validTime(iv.from) || !validTime(iv.to)) { toast.show(`${label}: enter times as HH:MM`, "error"); return; }
        if (iv.from >= iv.to) { toast.show(`${label}: closing time must be after opening`, "error"); return; }
        ivs.push([iv.from, iv.to]);
      }
      if (ivs.length) openingHours[key] = ivs;
    }

    setBusy(true);
    try {
      await updateStudio(supabase, studio.id, {
        name: name.trim(),
        bio: bio.trim() || null,
        email: em || null,
        phone: ph || null,
        website: web || null,
        addressLine: address.trim() || null,
        city: city.trim() || null,
        openingHours,
        logoPath,
        currencyCode: currency,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-studio", ctx.userId] }),
        qc.invalidateQueries({ queryKey: ["studio", studio.slug] }),
      ]);
      toast.show("Studio updated");
      router.back();
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const logoUri = logoPath ? imageUrl(logoPath, 120) : undefined;

  return (
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <Text style={s.section} accessibilityRole="header">Logo</Text>
      <View style={s.logoRow}>
        <View style={s.logoBox}>
          {logoUri ? <Image source={{ uri: logoUri }} style={s.logoImg} contentFit="cover" accessibilityLabel="Studio logo" /> : <Text style={s.logoInitial}>{name.charAt(0).toUpperCase()}</Text>}
        </View>
        <Pressable style={s.logoBtn} onPress={() => void pickLogo()} disabled={uploadingLogo} accessibilityRole="button" accessibilityLabel="Change logo">
          {uploadingLogo ? <ActivityIndicator /> : (<><Ionicons name="image-outline" size={17} color="#18181B" /><Text style={s.logoBtnText}>Change logo</Text></>)}
        </Pressable>
      </View>

      <Text style={s.section} accessibilityRole="header">Profile</Text>
      <View style={s.card}>
        <Field label="Studio name">
          <TextInput style={s.fieldInput} value={name} onChangeText={setName} placeholder="Studio name" placeholderTextColor="#A1A1AA" />
        </Field>
        <Field label="About" last>
          <TextInput style={[s.fieldInput, s.multiline]} value={bio} onChangeText={setBio} placeholder="Tell clients about your studio" placeholderTextColor="#A1A1AA" multiline />
        </Field>
      </View>

      <Text style={s.section} accessibilityRole="header">Contact</Text>
      <View style={s.card}>
        <Field label="Email">
          <TextInput style={s.fieldInput} value={email} onChangeText={setEmail} placeholder="hello@studio.com" placeholderTextColor="#A1A1AA" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field label="Phone">
          <TextInput style={s.fieldInput} value={phone} onChangeText={setPhone} placeholder="+30 …" placeholderTextColor="#A1A1AA" keyboardType="phone-pad" />
        </Field>
        <Field label="Website" last>
          <TextInput style={s.fieldInput} value={website} onChangeText={setWebsite} placeholder="studio.com" placeholderTextColor="#A1A1AA" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
        </Field>
      </View>

      <Text style={s.section} accessibilityRole="header">Currency</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.currRow} keyboardShouldPersistTaps="handled">
        {CURRENCY_OPTIONS.map((c) => {
          const active = currency === c;
          const sym = currencySymbol(c).trim();
          return (
            <Pressable key={c} style={[s.currChip, active && s.currChipActive]} onPress={() => setCurrency(c)} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={c}>
              <Text style={[s.currChipText, active && s.currChipTextActive]}>{sym && sym !== c ? `${sym} ${c}` : c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={s.hint}>Used to display revenue and prices across your dashboard.</Text>

      <Text style={s.section} accessibilityRole="header">Location</Text>
      <View style={s.card}>
        <Field label="City">
          <TextInput style={s.fieldInput} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#A1A1AA" />
        </Field>
        <Field label="Address" last>
          <TextInput style={s.fieldInput} value={address} onChangeText={setAddress} placeholder="Street address" placeholderTextColor="#A1A1AA" />
        </Field>
      </View>
      <Text style={s.hint}>The map location stays as set — contact support to move the pin.</Text>

      <Text style={s.section} accessibilityRole="header">Opening hours</Text>
      <View style={s.card}>
        {DAYS.map(([key, label], i) => {
          const d = hours[key]!;
          return (
            <View key={key} style={[s.dayBlock, i < DAYS.length - 1 && s.rowBorder]}>
              <View style={s.dayHead}>
                <Text style={s.dayLabel} numberOfLines={1}>{label}</Text>
                {!d.open ? <Text style={s.closed}>Closed</Text> : null}
                <Switch value={d.open} onValueChange={(v) => setDayOpen(key, v)} trackColor={{ true: "#E5484D" }} accessibilityLabel={`${label} open`} />
              </View>
              {d.open ? (
                <View style={s.intervals}>
                  {d.intervals.map((iv, idx) => (
                    <View key={idx} style={s.timeRow}>
                      <TextInput style={s.timeInput} value={iv.from} onChangeText={(v) => setInterval(key, idx, { from: maskTime(v) })} placeholder="10:00" placeholderTextColor="#A1A1AA" keyboardType="number-pad" maxLength={5} accessibilityLabel={`${label} opening time ${idx + 1}`} />
                      <Text style={s.timeDash}>–</Text>
                      <TextInput style={s.timeInput} value={iv.to} onChangeText={(v) => setInterval(key, idx, { to: maskTime(v) })} placeholder="18:00" placeholderTextColor="#A1A1AA" keyboardType="number-pad" maxLength={5} accessibilityLabel={`${label} closing time ${idx + 1}`} />
                      {d.intervals.length > 1 ? (
                        <Pressable onPress={() => removeInterval(key, idx)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${label} interval ${idx + 1}`}>
                          <Ionicons name="close-circle" size={22} color="#D4D4D8" />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  <Pressable style={s.addBtn} onPress={() => addInterval(key)} accessibilityRole="button" accessibilityLabel={`Add hours for ${label}`}>
                    <Ionicons name="add" size={16} color="#E5484D" />
                    <Text style={s.addBtnText}>Add hours</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <Text style={s.hint}>Add a second row for split shifts (e.g. 10:00–14:00 and 16:00–20:00).</Text>

      <Pressable style={[s.save, busy && s.disabled]} onPress={() => void save()} disabled={busy} accessibilityRole="button" accessibilityLabel="Save changes">
        <Text style={s.saveText}>{busy ? "Saving…" : "Save changes"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[s.field, !last && s.rowBorder]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA" },
  body: { padding: 16, paddingBottom: 48 },
  section: { fontSize: 12, fontWeight: "800", color: "#71717A", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#F0F0F2", borderRadius: 16, overflow: "hidden" },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  logoBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImg: { width: "100%", height: "100%" },
  logoInitial: { color: "#fff", fontSize: 26, fontWeight: "800" },
  logoBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  logoBtnText: { fontWeight: "700", fontSize: 14, color: "#18181B" },
  field: { paddingHorizontal: 14, paddingVertical: 10 },
  fieldLabel: { fontWeight: "700", fontSize: 12, color: "#A1A1AA", marginBottom: 2 },
  fieldInput: { fontSize: 15, color: "#18181B", paddingVertical: 4 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  hint: { color: "#A1A1AA", fontSize: 12, marginTop: 8, lineHeight: 17, paddingHorizontal: 2 },
  currRow: { flexDirection: "row", gap: 8, paddingVertical: 2, paddingRight: 8 },
  currChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F4F4F5" },
  currChipActive: { backgroundColor: "#18181B" },
  currChipText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  currChipTextActive: { color: "#fff" },
  dayBlock: { paddingHorizontal: 14, paddingVertical: 10 },
  dayHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  dayLabel: { flex: 1, fontWeight: "700", fontSize: 14, color: "#18181B" },
  closed: { color: "#A1A1AA", fontWeight: "600" },
  intervals: { marginTop: 8, gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: { flex: 1, backgroundColor: "#F4F4F5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, textAlign: "center", fontWeight: "700", color: "#18181B" },
  timeDash: { color: "#A1A1AA", fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  addBtnText: { color: "#E5484D", fontWeight: "800", fontSize: 13 },
  save: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 28 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
