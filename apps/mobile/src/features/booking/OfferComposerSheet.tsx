import { Ionicons } from "@expo/vector-icons";
import { bookingKeys, createOffer, useArtistAvailability, useArtistDaySlots, useBookingRequest } from "@inkora/data-access";
import { type AppointmentRequestId, slotMatchesTimeOfDay, TIME_OF_DAY_LABEL } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";
import { MonthCalendar } from "./components/MonthCalendar";
import { budgetRangeLabel, fmtDate, fmtTime, offerBudgetError } from "./components/ui";

const DURATIONS = [
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "Full day", minutes: 360 },
];

/** "30min", "1h", "1h30", "2h30" … */
function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}
function hmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** In-chat offer composer: propose a date/time, session length and price for a
 *  booking request. `prefillDate` (the client's preferred date) preselects the day. */
export function OfferComposerSheet({
  visible, requestId, artistId, prefillDate, onClose, onSent,
}: {
  visible: boolean; requestId: string; artistId: string; prefillDate?: string | null;
  onClose: () => void; onSent: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [duration, setDuration] = useState(120);
  const [customOpen, setCustomOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ start: string; end: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // While a session-length wheel is being dragged, freeze the page scroll so a
  // slightly-off swipe adjusts the wheel instead of scrolling the whole sheet.
  const [wheelActive, setWheelActive] = useState(false);

  const availabilityQ = useArtistAvailability(supabase, artistId);
  const enabledWeekdays = useMemo(() => Array.from(new Set((availabilityQ.data ?? []).map((a) => a.dayOfWeek))), [availabilityQ.data]);
  const slotsQ = useArtistDaySlots(supabase, artistId, date ?? "", duration);
  const reqQ = useBookingRequest(supabase, requestId);
  const budgetMin = reqQ.data?.budgetMin ?? null;
  const budgetMax = reqQ.data?.budgetMax ?? null;
  const pref = reqQ.data?.preferredTimeOfDay ?? null;
  const preferredDate = reqQ.data?.preferredDate ?? null;
  const [showAll, setShowAll] = useState(false);
  const allSlots = slotsQ.data ?? [];
  const filtering = !!pref && !showAll;
  const slots = filtering ? allSlots.filter((iso) => slotMatchesTimeOfDay(iso, pref)) : allSlots;

  // Custom session length runs in 30-min steps up to the artist's longest
  // availability window on the selected day (or their overall longest window
  // before a day is picked).
  const dayMaxMinutes = useMemo(() => {
    const avail = availabilityQ.data ?? [];
    const longest = (rows: typeof avail) => (rows.length ? Math.max(...rows.map((a) => hmToMinutes(a.endTime) - hmToMinutes(a.startTime))) : 0);
    if (date) {
      const wd = new Date(`${date}T00:00:00`).getDay();
      const dayWin = longest(avail.filter((a) => a.dayOfWeek === wd));
      if (dayWin > 0) return dayWin;
    }
    return longest(avail) || 480;
  }, [availabilityQ.data, date]);
  const isPreset = DURATIONS.some((d) => d.minutes === duration);
  // "Custom" is active while its box is open or a non-preset length is chosen.
  const usingCustom = customOpen || !isPreset;
  // Snap the current length onto the 30-min grid (and within today's max) when
  // the custom box opens, so the wheel lands on a real value.
  const openCustom = () => {
    if (!customOpen) {
      const grid = Math.max(30, Math.floor(dayMaxMinutes / 30) * 30);
      const norm = Math.min(grid, Math.max(30, Math.round(duration / 30) * 30));
      if (norm !== duration) { setDuration(norm); setPicked(null); }
    }
    setCustomOpen((v) => !v);
  };

  // Reset + prefill each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setDate(prefillDate ?? null);
      setPicked(null);
      setPrice("");
      setMessage("");
      setDuration(120);
      setCustomOpen(false);
    }
  }, [visible, prefillDate]);

  async function send() {
    if (!picked || !price) { toast.show("Pick a slot and enter a price to send your offer", "error"); return; }
    const budgetErr = offerBudgetError(Number(price), budgetMin, budgetMax);
    if (budgetErr) { toast.show(budgetErr, "error"); return; }
    setBusy(true);
    try {
      await createOffer(supabase, {
        requestId: requestId as AppointmentRequestId,
        proposedStart: picked.start,
        proposedEnd: picked.end,
        priceAmount: Number(price),
        message: message.trim() || null,
      });
      // Sending an offer moves the request to "offered" and clears the artist's
      // "new request" notification — refresh every view that reflects that.
      await Promise.all([
        qc.invalidateQueries({ queryKey: bookingKeys.request(requestId) }),
        qc.invalidateQueries({ queryKey: bookingKeys.clientRequests }),
        qc.invalidateQueries({ queryKey: bookingKeys.artistRequests }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
      onSent();
      onClose();
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <Text style={s.title} accessibilityRole="header">Send an offer</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={26} color="#18181B" /></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" scrollEnabled={!wheelActive}>
          <Text style={s.label}>Session length</Text>
          <View style={s.chipWrap}>
            {DURATIONS.map((d) => {
              const on = !usingCustom && duration === d.minutes;
              return (
                <Pressable key={d.minutes} style={[s.durChip, on && s.durChipActive]} onPress={() => { setDuration(d.minutes); setPicked(null); setCustomOpen(false); }}>
                  <Text style={[s.durChipText, on && s.durChipTextActive]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={[s.customBox, usingCustom && s.customBoxActive]} onPress={openCustom} accessibilityRole="button" accessibilityLabel="Custom session length">
            <Text style={[s.customBoxLabel, usingCustom && s.customBoxLabelActive]}>{usingCustom ? fmtDuration(duration) : "Custom length"}</Text>
            <Ionicons name={customOpen ? "chevron-up" : "chevron-down"} size={18} color={usingCustom ? "#18181B" : "#71717A"} />
          </Pressable>
          {customOpen ? (
            <HourMinutePicker value={duration} maxMinutes={dayMaxMinutes} onChange={(m) => { setDuration(m); setPicked(null); }} onActive={setWheelActive} />
          ) : null}

          <Text style={s.label}>Propose a time</Text>
          {preferredDate || pref ? (
            <View style={s.preferBox}>
              <Ionicons name="calendar" size={16} color="#B45309" />
              <Text style={s.preferText}>
                Client prefers {[preferredDate ? fmtDate(preferredDate) : null, pref ? TIME_OF_DAY_LABEL[pref] : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ) : null}
          <MonthCalendar selected={date} onSelect={(d) => { setDate(d); setPicked(null); }} enabledWeekdays={enabledWeekdays.length ? enabledWeekdays : undefined} />
          {pref && date ? (
            <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={6} accessibilityRole="button">
              <Text style={s.slotFilterNote}>
                {showAll ? `Showing all times · Show ${TIME_OF_DAY_LABEL[pref]} only` : `Client prefers ${TIME_OF_DAY_LABEL[pref]} · Show all times`}
              </Text>
            </Pressable>
          ) : null}
          {date ? (
            slotsQ.isLoading ? <ActivityIndicator style={{ marginTop: 8 }} /> :
            slots.length === 0 ? (
              <Text style={s.muted}>
                {filtering && allSlots.length > 0 ? `No ${TIME_OF_DAY_LABEL[pref!].toLowerCase()} slots that day — tap above to show all.` : "No open slots that day."}
              </Text>
            ) :
            <View style={s.chipWrap}>
              {slots.map((iso) => {
                const end = new Date(new Date(iso).getTime() + duration * 60000).toISOString();
                const active = picked?.start === iso;
                return (
                  <Pressable key={iso} style={[s.slotChip, active && s.slotChipActive]} onPress={() => setPicked({ start: iso, end })}>
                    <Text style={[s.slotChipText, active && s.slotChipTextActive]}>{fmtTime(iso)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text style={s.label}>Price estimate (€)</Text>
          {budgetMin != null || budgetMax != null ? (
            <Text style={s.budgetHint}>Client&apos;s budget: {budgetRangeLabel(budgetMin, budgetMax)} — keep your offer within this range.</Text>
          ) : null}
          <TextInput style={s.input} keyboardType="number-pad" value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ""))} placeholder="0" />
          <Text style={s.note}>An indicative quote — payment is arranged directly with the client, not through Inkora.</Text>
          <Text style={s.label}>Message</Text>
          <TextInput style={[s.input, s.multiline]} value={message} onChangeText={setMessage} placeholder="Anything the client should know" multiline />

          <Pressable style={[s.send, busy && s.disabled]} onPress={send} disabled={busy} accessibilityRole="button" accessibilityLabel="Send offer">
            <Text style={s.sendText}>{busy ? "Sending…" : "Send offer"}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const ITEM_H = 40;
const VISIBLE = 3;
const WHEEL_H = ITEM_H * VISIBLE;

/** A single snap-scrolling wheel: whatever number sits under the centre rail is
 *  the selection. Scrolling rolls the next/previous value into that fixed spot. */
function Wheel({ items, value, onChange, format, onActive }: {
  items: number[]; value: number; onChange: (v: number) => void; format: (v: number) => string; onActive: (a: boolean) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.indexOf(value));
  const [center, setCenter] = useState(index);
  const clampIdx = (y: number) => Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));

  // Park the wheel on the selected value when it (or the option set) changes
  // from outside — e.g. choosing a new hour trims the available minutes.
  useEffect(() => {
    setCenter(index);
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
  }, [index, items.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clampIdx(e.nativeEvent.contentOffset.y);
    if (i !== center) setCenter(i);
  };
  // Snap to the nearest value + commit it. Deliberately does NOT re-enable the
  // page scroll: onScrollEndDrag also fires when the wheel hits its edge and
  // Android hands the drag to the parent, so re-enabling here would let that
  // overscroll move the page. The page is unfrozen on touch-end / momentum-end.
  const snapTo = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clampIdx(e.nativeEvent.contentOffset.y);
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
    const v = items[i];
    if (v != null && v !== value) onChange(v);
  };

  return (
    <ScrollView
      ref={ref}
      style={s.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      disableIntervalMomentum
      decelerationRate="fast"
      scrollEventThrottle={16}
      overScrollMode="never"
      onScroll={onScroll}
      onScrollBeginDrag={() => onActive(true)}
      onScrollEndDrag={snapTo}
      onMomentumScrollEnd={(e) => { snapTo(e); onActive(false); }}
      contentContainerStyle={s.wheelInner}
      nestedScrollEnabled
    >
      {items.map((it, i) => {
        const d = Math.abs(i - center);
        return (
          <View key={it} style={s.wheelItem}>
            <Text style={[s.wheelText, d === 0 ? s.wheelTextOn : d === 1 ? s.wheelTextNear : s.wheelTextFar]}>{format(it)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** Two-wheel length picker: Hours | Minutes (00 / 30). The 30-minute option
 *  drops out once it would exceed today's longest window (with a note); the
 *  minimum session is 30 minutes. */
function HourMinutePicker({ value, maxMinutes, onChange, onActive }: { value: number; maxMinutes: number; onChange: (min: number) => void; onActive: (a: boolean) => void }) {
  const maxHours = Math.floor(maxMinutes / 60);
  const hours = Array.from({ length: maxHours + 1 }, (_, i) => i);
  const selH = Math.floor(value / 60);
  const selM = value % 60;
  const canThirty = (h: number) => h * 60 + 30 <= maxMinutes; // +30 still fits today
  const canZero = (h: number) => h >= 1; // 0h 00min would be a zero-length session
  const minutes = [...(canZero(selH) ? [0] : []), ...(canThirty(selH) ? [30] : [])];
  if (minutes.length === 0) minutes.push(0);
  const thirtyBlocked = !canThirty(selH);

  const setHour = (h: number) => {
    let m = selM;
    if (m === 30 && !canThirty(h)) m = 0;
    if (m === 0 && !canZero(h)) m = 30;
    onChange(h * 60 + m);
  };
  const setMin = (m: number) => onChange(selH * 60 + m);

  return (
    <View
      style={s.pickerBox}
      onTouchStart={() => onActive(true)}
      onTouchEnd={() => onActive(false)}
      onTouchCancel={() => onActive(false)}
    >
      <View style={s.pickerLabels}>
        <Text style={s.pickerColLabel}>Hours</Text>
        <Text style={s.pickerColLabel}>Minutes</Text>
      </View>
      <View style={s.wheelRow}>
        <View pointerEvents="none" style={s.centerBand} />
        <Wheel items={hours} value={selH} onChange={setHour} format={(h) => `${h}`} onActive={onActive} />
        <Wheel items={minutes} value={selM} onChange={setMin} format={(m) => String(m).padStart(2, "0")} onActive={onActive} />
      </View>
      {thirtyBlocked ? <Text style={s.pickerNote}>Maximum time to allocate for a session is {fmtDuration(maxMinutes)} today.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  title: { fontSize: 18, fontWeight: "800" },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontWeight: "700", marginTop: 16, marginBottom: 6 },
  muted: { color: "#A1A1AA", marginTop: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F4F4F5" },
  durChipActive: { backgroundColor: "#18181B" },
  durChipText: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  durChipTextActive: { color: "#fff" },
  customBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E9E9EC", backgroundColor: "#fff" },
  customBoxActive: { borderColor: "#18181B" },
  customBoxLabel: { fontWeight: "600", color: "#A1A1AA", fontSize: 15, letterSpacing: 0.2 },
  customBoxLabelActive: { color: "#18181B", fontWeight: "800" },
  pickerBox: { marginTop: 8, borderWidth: 1, borderColor: "#EFEFF1", borderRadius: 16, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 12, backgroundColor: "#fff" },
  pickerLabels: { flexDirection: "row", marginBottom: 4 },
  pickerColLabel: { flex: 1, fontSize: 11, fontWeight: "700", color: "#A1A1AA", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
  wheelRow: { flexDirection: "row", height: WHEEL_H },
  centerBand: { position: "absolute", left: 6, right: 6, top: (WHEEL_H - ITEM_H) / 2, height: ITEM_H, borderRadius: 12, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#F6C7C9" },
  wheel: { flex: 1, height: WHEEL_H },
  wheelInner: { paddingVertical: (WHEEL_H - ITEM_H) / 2 },
  wheelItem: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  wheelText: { fontSize: 21 },
  wheelTextOn: { color: "#E5484D", fontWeight: "800" },
  wheelTextNear: { color: "#B4B4B8", fontWeight: "600" },
  wheelTextFar: { color: "#DCDCE0", fontWeight: "600" },
  pickerNote: { color: "#71717A", fontSize: 12, fontWeight: "500", marginTop: 12, textAlign: "center" },
  slotChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F4F4F5" },
  slotChipActive: { backgroundColor: "#E5484D" },
  slotChipText: { fontWeight: "700", color: "#18181B", fontSize: 13 },
  slotChipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  note: { color: "#71717A", fontSize: 12, marginTop: 6 },
  budgetHint: { color: "#B45309", fontSize: 12, marginTop: 4, marginBottom: 2, fontWeight: "600" },
  slotFilterNote: { color: "#B45309", fontSize: 12, fontWeight: "700", marginTop: 8 },
  preferBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6, marginBottom: 2 },
  preferText: { flex: 1, color: "#92400E", fontWeight: "700", fontSize: 14 },
  send: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
