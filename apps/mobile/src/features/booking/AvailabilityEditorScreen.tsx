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

interface Interval { start: number; end: number } // minutes from midnight
interface DayState { open: boolean; intervals: Interval[] }

const defaultInterval = (): Interval => ({ start: 11 * 60, end: 19 * 60 });

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
    for (let d = 0; d < 7; d++) init[d] = { open: false, intervals: [defaultInterval()] };
    return init;
  });
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (availQ.data && !hydrated) {
      setDays((prev) => {
        const next = { ...prev };
        // Group every stored slot back under its day, so split shifts survive.
        const byDay: Record<number, Interval[]> = {};
        for (const slot of availQ.data ?? []) {
          (byDay[slot.dayOfWeek] ??= []).push({ start: toMin(slot.startTime), end: toMin(slot.endTime) });
        }
        for (const [dow, ivs] of Object.entries(byDay)) {
          ivs.sort((a, b) => a.start - b.start);
          next[Number(dow)] = { open: true, intervals: ivs.length ? ivs : [defaultInterval()] };
        }
        return next;
      });
      setHydrated(true);
    }
  }, [availQ.data, hydrated]);

  const openCount = useMemo(() => Object.values(days).filter((d) => d.open).length, [days]);

  const setDayOpen = (dow: number, open: boolean) => setDays((p) => ({ ...p, [dow]: { ...p[dow]!, open } }));
  const setInterval = (dow: number, idx: number, patch: Partial<Interval>) =>
    setDays((p) => ({ ...p, [dow]: { ...p[dow]!, intervals: p[dow]!.intervals.map((iv, i) => (i === idx ? { ...iv, ...patch } : iv)) } }));
  const addInterval = (dow: number) =>
    setDays((p) => ({ ...p, [dow]: { ...p[dow]!, intervals: [...p[dow]!.intervals, defaultInterval()] } }));
  const removeInterval = (dow: number, idx: number) =>
    setDays((p) => {
      const kept = p[dow]!.intervals.filter((_, i) => i !== idx);
      return { ...p, [dow]: { ...p[dow]!, intervals: kept.length ? kept : [defaultInterval()] } };
    });
  const stepStart = (dow: number, idx: number, delta: number) => {
    const iv = days[dow]!.intervals[idx]!;
    const start = Math.min(Math.max(iv.start + delta, MIN_START), iv.end - STEP);
    setInterval(dow, idx, { start });
  };
  const stepEnd = (dow: number, idx: number, delta: number) => {
    const iv = days[dow]!.intervals[idx]!;
    const end = Math.min(Math.max(iv.end + delta, iv.start + STEP), MAX_END);
    setInterval(dow, idx, { end });
  };

  async function save() {
    // Build the slot list, guarding against overlapping ranges within a day
    // (they'd double-count bookable slots).
    const slots: AvailabilityInput[] = [];
    for (const d of DAY_ORDER) {
      const day = days[d]!;
      if (!day.open) continue;
      const ivs = [...day.intervals].sort((a, b) => a.start - b.start);
      for (let i = 0; i < ivs.length; i++) {
        if (i > 0 && ivs[i]!.start < ivs[i - 1]!.end) {
          toast.show(`${DAY_FULL[d]}: time ranges can’t overlap`, "error");
          return;
        }
        slots.push({ dayOfWeek: d, startTime: dbTime(ivs[i]!.start), endTime: dbTime(ivs[i]!.end) });
      }
    }
    setSaving(true);
    try {
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
          <Text style={s.intro}>Set the days and hours you take appointments. Clients see open slots when booking. Add a second range for a split day (e.g. a lunch break).</Text>
          {DAY_ORDER.map((dow) => {
            const d = days[dow]!;
            return (
              <View key={dow} style={s.dayCard}>
                <View style={s.dayHead}>
                  <Text style={s.dayName}>{DAY_FULL[dow]}</Text>
                  <Switch
                    value={d.open}
                    onValueChange={(v) => setDayOpen(dow, v)}
                    trackColor={{ true: "#E5484D" }}
                    accessibilityLabel={`${DAY_FULL[dow]} open`}
                  />
                </View>
                {d.open ? (
                  <View style={s.intervals}>
                    {d.intervals.map((iv, idx) => (
                      <View key={idx} style={s.intervalRow}>
                        <View style={s.timesRow}>
                          <TimePicker label="Opens" value={iv.start} onDec={() => stepStart(dow, idx, -STEP)} onInc={() => stepStart(dow, idx, STEP)} />
                          <TimePicker label="Closes" value={iv.end} onDec={() => stepEnd(dow, idx, -STEP)} onInc={() => stepEnd(dow, idx, STEP)} />
                        </View>
                        {d.intervals.length > 1 ? (
                          <Pressable onPress={() => removeInterval(dow, idx)} hitSlop={8} style={s.removeBtn} accessibilityRole="button" accessibilityLabel={`Remove ${DAY_FULL[dow]} time range ${idx + 1}`}>
                            <Ionicons name="close-circle" size={22} color="#D4D4D8" />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    <Pressable style={s.addBtn} onPress={() => addInterval(dow)} accessibilityRole="button" accessibilityLabel={`Add another time range for ${DAY_FULL[dow]}`}>
                      <Ionicons name="add" size={16} color="#E5484D" />
                      <Text style={s.addBtnText}>Add hours</Text>
                    </Pressable>
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
  intervals: { marginTop: 12, gap: 10 },
  intervalRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  timesRow: { flex: 1, flexDirection: "row", gap: 12 },
  removeBtn: { paddingBottom: 6 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 2 },
  addBtnText: { color: "#E5484D", fontWeight: "800", fontSize: 13 },
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
