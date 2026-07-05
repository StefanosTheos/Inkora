import { Ionicons } from "@expo/vector-icons";
import { type AvailabilityInput, setArtistAvailability, useArtistAvailability, useAuth } from "@inkora/data-access";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";

// Mon-first display order over the 0=Sun … 6=Sat convention.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STEP = 30; // minutes
const MIN_START = 0;
const MAX_END = 24 * 60;

interface DayState { open: boolean; start: number; end: number } // start/end = minutes from midnight

const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const fmt = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dbTime = (min: number): string => `${fmt(min)}:00`;
const deviceTz = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
};

export function AvailabilityEditorScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const availQ = useArtistAvailability(supabase, meId);

  const [days, setDays] = useState<Record<number, DayState>>(() => {
    const init: Record<number, DayState> = {};
    for (let d = 0; d < 7; d++) init[d] = { open: false, start: 11 * 60, end: 19 * 60 };
    return init;
  });
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (availQ.data && !hydrated) {
      setDays((prev) => {
        const next = { ...prev };
        for (const slot of availQ.data ?? []) {
          next[slot.dayOfWeek] = { open: true, start: toMin(slot.startTime), end: toMin(slot.endTime) };
        }
        return next;
      });
      setHydrated(true);
    }
  }, [availQ.data, hydrated]);

  const openCount = useMemo(() => Object.values(days).filter((d) => d.open).length, [days]);

  const setDay = (dow: number, patch: Partial<DayState>) => setDays((p) => ({ ...p, [dow]: { ...p[dow]!, ...patch } }));
  const stepStart = (dow: number, delta: number) => {
    const d = days[dow]!;
    const start = Math.min(Math.max(d.start + delta, MIN_START), d.end - STEP);
    setDay(dow, { start });
  };
  const stepEnd = (dow: number, delta: number) => {
    const d = days[dow]!;
    const end = Math.min(Math.max(d.end + delta, d.start + STEP), MAX_END);
    setDay(dow, { end });
  };

  async function save() {
    setSaving(true);
    try {
      const slots: AvailabilityInput[] = DAY_ORDER.filter((d) => days[d]!.open).map((d) => ({
        dayOfWeek: d, startTime: dbTime(days[d]!.start), endTime: dbTime(days[d]!.end),
      }));
      await setArtistAvailability(supabase, slots, deviceTz());
      await qc.invalidateQueries({ queryKey: ["artist-availability", meId] });
      toast.show(slots.length ? "Availability updated" : "Availability cleared");
      router.back();
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">Availability</Text>
        <View style={{ width: 26 }} />
      </View>

      {availQ.isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.intro}>Set the days and hours you take appointments. Clients see open slots when booking.</Text>
          {DAY_ORDER.map((dow) => {
            const d = days[dow]!;
            return (
              <View key={dow} style={s.dayCard}>
                <View style={s.dayHead}>
                  <Text style={s.dayName}>{DAY_FULL[dow]}</Text>
                  <Switch
                    value={d.open}
                    onValueChange={(v) => setDay(dow, { open: v })}
                    trackColor={{ true: "#E5484D" }}
                    accessibilityLabel={`${DAY_FULL[dow]} open`}
                  />
                </View>
                {d.open ? (
                  <View style={s.timesRow}>
                    <TimePicker label="Opens" value={d.start} onDec={() => stepStart(dow, -STEP)} onInc={() => stepStart(dow, STEP)} />
                    <TimePicker label="Closes" value={d.end} onDec={() => stepEnd(dow, -STEP)} onInc={() => stepEnd(dow, STEP)} />
                  </View>
                ) : (
                  <Text style={s.closed}>Closed</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={s.footer}>
        <Pressable style={[s.saveBtn, saving && s.disabled]} disabled={saving} onPress={save} accessibilityRole="button" accessibilityLabel="Save availability">
          <Text style={s.saveText}>{saving ? "Saving…" : `Save${openCount ? ` (${openCount} day${openCount === 1 ? "" : "s"})` : ""}`}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TimePicker({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  return (
    <View style={s.timeCol}>
      <Text style={s.timeLabel}>{label}</Text>
      <View style={s.stepper}>
        <Pressable style={s.stepBtn} onPress={onDec} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${label} earlier`}><Ionicons name="remove" size={18} color="#18181B" /></Pressable>
        <Text style={s.timeValue}>{fmt(value)}</Text>
        <Pressable style={s.stepBtn} onPress={onInc} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${label} later`}><Ionicons name="add" size={18} color="#18181B" /></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 16, gap: 12 },
  intro: { color: "#71717A", fontSize: 14, lineHeight: 20, marginBottom: 4 },
  dayCard: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, padding: 14 },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { fontSize: 16, fontWeight: "800", color: "#18181B" },
  closed: { color: "#A1A1AA", marginTop: 6 },
  timesRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  timeCol: { flex: 1, gap: 6 },
  timeLabel: { color: "#71717A", fontSize: 12, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  timeValue: { fontWeight: "800", fontSize: 15, minWidth: 52, textAlign: "center" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  saveBtn: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
});
