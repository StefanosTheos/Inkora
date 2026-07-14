import { Ionicons } from "@expo/vector-icons";
import { updateStudio, useAuth, useMyStudio } from "@inkora/data-access";
import type { StudioProfile } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";

const DAYS: [string, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

type DayHours = { open: boolean; from: string; to: string };

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
  const [hours, setHours] = useState<Record<string, DayHours>>(() => {
    const h: Record<string, DayHours> = {};
    for (const [key] of DAYS) {
      const iv = studio.openingHours[key]?.[0];
      h[key] = iv ? { open: true, from: iv[0] ?? "10:00", to: iv[1] ?? "18:00" } : { open: false, from: "10:00", to: "18:00" };
    }
    return h;
  });
  const [busy, setBusy] = useState(false);
  const setDay = (key: string, patch: Partial<DayHours>) => setHours((p) => ({ ...p, [key]: { ...p[key]!, ...patch } }));

  async function save() {
    if (!name.trim()) { toast.show("Studio name is required", "error"); return; }
    const openingHours: Record<string, string[][]> = {};
    for (const [key, label] of DAYS) {
      const d = hours[key]!;
      if (!d.open) continue;
      if (!validTime(d.from) || !validTime(d.to)) { toast.show(`${label}: enter times as HH:MM`, "error"); return; }
      if (d.from >= d.to) { toast.show(`${label}: closing time must be after opening`, "error"); return; }
      openingHours[key] = [[d.from, d.to]];
    }
    setBusy(true);
    try {
      await updateStudio(supabase, studio.id, {
        name: name.trim(),
        bio: bio.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        addressLine: address.trim() || null,
        city: city.trim() || null,
        openingHours,
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

  return (
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Studio name</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Studio name" />

      <Text style={s.label}>About</Text>
      <TextInput style={[s.input, s.multiline]} value={bio} onChangeText={setBio} placeholder="Tell clients about your studio" multiline />

      <Text style={s.section}>Contact</Text>
      <Text style={s.label}>Email</Text>
      <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="hello@studio.com" keyboardType="email-address" autoCapitalize="none" />
      <Text style={s.label}>Phone</Text>
      <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+30 …" keyboardType="phone-pad" />
      <Text style={s.label}>Website</Text>
      <TextInput style={s.input} value={website} onChangeText={setWebsite} placeholder="https://…" keyboardType="url" autoCapitalize="none" />

      <Text style={s.section}>Location</Text>
      <Text style={s.label}>City</Text>
      <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="City" />
      <Text style={s.label}>Address</Text>
      <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Street address" />
      <Text style={s.hint}>The map location stays as set — contact support to move the pin.</Text>

      <Text style={s.section}>Opening hours</Text>
      {DAYS.map(([key, label]) => {
        const d = hours[key]!;
        return (
          <View key={key} style={s.dayRow}>
            <Text style={s.dayLabel}>{label}</Text>
            {d.open ? (
              <View style={s.timeRow}>
                <TextInput style={s.timeInput} value={d.from} onChangeText={(v) => setDay(key, { from: maskTime(v) })} placeholder="10:00" keyboardType="number-pad" maxLength={5} accessibilityLabel={`${label} opening time`} />
                <Text style={s.timeDash}>–</Text>
                <TextInput style={s.timeInput} value={d.to} onChangeText={(v) => setDay(key, { to: maskTime(v) })} placeholder="18:00" keyboardType="number-pad" maxLength={5} accessibilityLabel={`${label} closing time`} />
              </View>
            ) : (
              <Text style={s.closed}>Closed</Text>
            )}
            <Switch value={d.open} onValueChange={(v) => setDay(key, { open: v })} trackColor={{ true: "#18181B", false: "#E4E4E7" }} thumbColor="#fff" />
          </View>
        );
      })}

      <Pressable style={[s.save, busy && s.disabled]} onPress={() => void save()} disabled={busy} accessibilityRole="button" accessibilityLabel="Save changes">
        <Text style={s.saveText}>{busy ? "Saving…" : "Save changes"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#A1A1AA" },
  body: { padding: 16, paddingBottom: 48 },
  section: { fontSize: 17, fontWeight: "800", marginTop: 24, marginBottom: 4 },
  label: { fontWeight: "700", fontSize: 13, color: "#3F3F46", marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  hint: { color: "#A1A1AA", fontSize: 12, marginTop: 6, lineHeight: 17 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  dayLabel: { width: 84, fontWeight: "700", fontSize: 14, color: "#18181B" },
  timeRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: { flex: 1, backgroundColor: "#F4F4F5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, textAlign: "center", fontWeight: "700" },
  timeDash: { color: "#A1A1AA", fontWeight: "700" },
  closed: { flex: 1, color: "#A1A1AA", fontWeight: "600" },
  save: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 28 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
