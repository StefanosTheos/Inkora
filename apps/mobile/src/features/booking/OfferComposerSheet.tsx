import { Ionicons } from "@expo/vector-icons";
import { bookingKeys, createOffer, useArtistAvailability, useArtistDaySlots, useBookingRequest } from "@inkora/data-access";
import type { AppointmentRequestId } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";
import { MonthCalendar } from "./components/MonthCalendar";
import { budgetRangeLabel, fmtTime, offerBudgetError } from "./components/ui";

const DURATIONS = [
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "Full day", minutes: 360 },
];

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
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ start: string; end: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const availabilityQ = useArtistAvailability(supabase, artistId);
  const enabledWeekdays = useMemo(() => Array.from(new Set((availabilityQ.data ?? []).map((a) => a.dayOfWeek))), [availabilityQ.data]);
  const slotsQ = useArtistDaySlots(supabase, artistId, date ?? "", duration);
  const reqQ = useBookingRequest(supabase, requestId);
  const budgetMin = reqQ.data?.budgetMin ?? null;
  const budgetMax = reqQ.data?.budgetMax ?? null;

  // Reset + prefill each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setDate(prefillDate ?? null);
      setPicked(null);
      setPrice("");
      setMessage("");
      setDuration(120);
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
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Session length</Text>
          <View style={s.chipWrap}>
            {DURATIONS.map((d) => (
              <Pressable key={d.minutes} style={[s.durChip, duration === d.minutes && s.durChipActive]} onPress={() => { setDuration(d.minutes); setPicked(null); }}>
                <Text style={[s.durChipText, duration === d.minutes && s.durChipTextActive]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.label}>Propose a time</Text>
          <MonthCalendar selected={date} onSelect={(d) => { setDate(d); setPicked(null); }} enabledWeekdays={enabledWeekdays.length ? enabledWeekdays : undefined} />
          {date ? (
            slotsQ.isLoading ? <ActivityIndicator style={{ marginTop: 8 }} /> :
            (slotsQ.data ?? []).length === 0 ? <Text style={s.muted}>No open slots that day.</Text> :
            <View style={s.chipWrap}>
              {(slotsQ.data ?? []).map((iso) => {
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
  slotChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F4F4F5" },
  slotChipActive: { backgroundColor: "#E5484D" },
  slotChipText: { fontWeight: "700", color: "#18181B", fontSize: 13 },
  slotChipTextActive: { color: "#fff" },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  note: { color: "#71717A", fontSize: 12, marginTop: 6 },
  budgetHint: { color: "#B45309", fontSize: 12, marginTop: 4, marginBottom: 2, fontWeight: "600" },
  send: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
