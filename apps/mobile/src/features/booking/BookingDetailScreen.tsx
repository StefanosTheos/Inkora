import { Ionicons } from "@expo/vector-icons";
import {
  bookingKeys, cancelAppointment, cancelRequest, completeAppointment, createOffer, declineRequest,
  getChatSignedUrl, respondToOffer, rescheduleAppointment, useAppointment, useArtistAvailability,
  useArtistDaySlots, useAuth, useBookingRequest, withdrawOffer,
} from "@inkora/data-access";
import {
  APPOINTMENT_STATUS_LABEL, type AppointmentRequestView, type AppointmentView, type OfferView, REQUEST_STATUS_LABEL,
} from "@inkora/domain";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { MonthCalendar } from "./components/MonthCalendar";
import { Avatar, fmtDate, fmtDateTime, fmtTime, money, StatusChip } from "./components/ui";

const DURATIONS = [
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "Full day", minutes: 360 },
];

export function BookingDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const apptQ = useAppointment(supabase, id);
  const reqQ = useBookingRequest(supabase, id);

  let content: React.ReactNode;
  if (apptQ.data) content = <AppointmentDetail appt={apptQ.data} meId={meId} />;
  else if (reqQ.data) content = <RequestDetail req={reqQ.data} meId={meId} />;
  else if (apptQ.isLoading || reqQ.isLoading) content = <View style={s.center}><ActivityIndicator /></View>;
  else content = <View style={s.center}><Text style={s.muted}>This booking no longer exists.</Text></View>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle}>Booking</Text>
        <View style={{ width: 26 }} />
      </View>
      {content}
    </SafeAreaView>
  );
}

// ============================================================ APPOINTMENT
function AppointmentDetail({ appt, meId }: { appt: AppointmentView; meId: string }) {
  const qc = useQueryClient();
  const isArtist = appt.artistId === meId;
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const durationMin = Math.round((new Date(appt.scheduledEnd).getTime() - new Date(appt.scheduledStart).getTime()) / 60000);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: bookingKeys.appointments });
      await qc.invalidateQueries({ queryKey: bookingKeys.appointment(appt.id) });
    } catch (e) {
      Alert.alert("Something went wrong", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const active = appt.status === "scheduled" || appt.status === "rescheduled";

  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.partyRow}>
        <Avatar path={appt.counterparty.avatarPath} name={appt.counterparty.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={s.partyName}>{appt.counterparty.name}</Text>
          <Text style={s.muted}>{isArtist ? "Client" : "Artist"}</Text>
        </View>
        <StatusChip status={appt.status} label={APPOINTMENT_STATUS_LABEL[appt.status]} />
      </View>

      <View style={s.infoCard}>
        {appt.studioName ? <InfoRow icon="home-outline" label={`Booked via ${appt.studioName}`} /> : null}
        <InfoRow icon="calendar-outline" label={fmtDate(appt.scheduledStart)} />
        <InfoRow icon="time-outline" label={`${fmtTime(appt.scheduledStart)} – ${fmtTime(appt.scheduledEnd)}`} />
        {appt.priceAmount != null ? <InfoRow icon="pricetag-outline" label={money(appt.priceAmount)} /> : null}
        {appt.locationNote ? <InfoRow icon="location-outline" label={appt.locationNote} /> : null}
      </View>

      {appt.cancellationReason ? <Text style={s.muted}>Reason: {appt.cancellationReason}</Text> : null}

      {rescheduling && active ? (
        <SlotPicker
          artistId={appt.artistId}
          durationMinutes={durationMin}
          onCancel={() => setRescheduling(false)}
          onPick={(start, end) => run(async () => {
            await rescheduleAppointment(supabase, appt.id, start, end);
            setRescheduling(false);
          })}
        />
      ) : active ? (
        <View style={s.actions}>
          <SecondaryBtn label="Reschedule" onPress={() => setRescheduling(true)} disabled={busy} />
          {isArtist && <SecondaryBtn label="Mark completed" onPress={() => run(() => completeAppointment(supabase, appt.id))} disabled={busy} />}
          <DangerBtn
            label="Cancel appointment"
            disabled={busy}
            onPress={() => Alert.alert("Cancel appointment?", "The other person will be notified.", [
              { text: "Keep", style: "cancel" },
              { text: "Cancel it", style: "destructive", onPress: () => run(() => cancelAppointment(supabase, appt.id)) },
            ])}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

// ============================================================ REQUEST
function RequestDetail({ req, meId }: { req: AppointmentRequestView; meId: string }) {
  const qc = useQueryClient();
  const isArtist = req.artistId === meId;
  const [busy, setBusy] = useState(false);

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: bookingKeys.request(req.id) });
    await qc.invalidateQueries({ queryKey: bookingKeys.clientRequests });
    await qc.invalidateQueries({ queryKey: bookingKeys.artistRequests });
    await qc.invalidateQueries({ queryKey: bookingKeys.appointments });
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); await invalidate(); }
    catch (e) { Alert.alert("Something went wrong", (e as Error).message); }
    finally { setBusy(false); }
  }

  const router = useRouter();
  const openForArtist = isArtist && (req.status === "pending" || req.status === "reviewing" || req.status === "offered");
  const clientCanCancel = !isArtist && req.status !== "converted" && req.status !== "cancelled" && req.status !== "declined";

  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.partyRow}>
        <Avatar path={req.counterparty.avatarPath} name={req.counterparty.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={s.partyName}>{req.counterparty.name}</Text>
          <Text style={s.muted}>{isArtist ? "Client" : "Artist"}</Text>
        </View>
        <StatusChip status={req.status} label={REQUEST_STATUS_LABEL[req.status]} />
      </View>

      <Text style={s.reqTitle}>{req.title}</Text>
      {req.description ? <Text style={s.reqBody}>{req.description}</Text> : null}

      <View style={s.tagRow}>
        {req.studioName ? <Tag text={`🏠 ${req.studioName}`} /> : null}
        {req.placement ? <Tag text={req.placement} /> : null}
        {req.approxSize ? <Tag text={req.approxSize} /> : null}
        {req.isColor != null ? <Tag text={req.isColor ? "Color" : "Black & grey"} /> : null}
        {req.preferredDate ? <Tag text={`Prefers ${fmtDate(req.preferredDate)}`} /> : null}
        {req.budgetMin || req.budgetMax ? <Tag text={`Budget ${money(req.budgetMin, "EUR")}–${money(req.budgetMax, "EUR")}`} /> : null}
      </View>

      {req.referencePaths.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.refs}>
          {req.referencePaths.map((p) => <SignedThumb key={p} path={p} />)}
        </ScrollView>
      )}

      {/* Offers */}
      {req.offers.length > 0 && <Text style={s.sectionTitle}>Offers</Text>}
      {req.offers.map((o) => (
        <OfferCard
          key={o.id}
          offer={o}
          isArtist={isArtist}
          busy={busy}
          onAccept={() => run(async () => {
            const apptId = await respondToOffer(supabase, o.id, true);
            if (apptId) router.replace(`/booking/${apptId}`);
          })}
          onDecline={() => run(async () => { await respondToOffer(supabase, o.id, false); })}
          onWithdraw={() => run(() => withdrawOffer(supabase, o.id))}
        />
      ))}

      {/* Artist: send an offer */}
      {openForArtist && <ArtistOfferComposer req={req} onSent={invalidate} />}

      {/* Artist decline */}
      {isArtist && (req.status === "pending" || req.status === "reviewing") && (
        <DangerBtn label="Decline request" disabled={busy} onPress={() => run(() => declineRequest(supabase, req.id))} />
      )}

      {/* Client cancel */}
      {clientCanCancel && (
        <DangerBtn label="Cancel request" disabled={busy} onPress={() => run(() => cancelRequest(supabase, req.id))} />
      )}
    </ScrollView>
  );
}

function OfferCard({ offer, isArtist, busy, onAccept, onDecline, onWithdraw }: {
  offer: OfferView; isArtist: boolean; busy: boolean;
  onAccept: () => void; onDecline: () => void; onWithdraw: () => void;
}) {
  const pending = offer.status === "pending";
  return (
    <View style={s.offerCard}>
      <View style={s.offerHead}>
        <Text style={s.offerPrice}>{money(offer.priceAmount, offer.currencyCode)}</Text>
        {!pending && <StatusChip status={offer.status} label={offer.status[0]!.toUpperCase() + offer.status.slice(1)} />}
      </View>
      {offer.proposedStart ? <Text style={s.offerLine}>🗓 {fmtDateTime(offer.proposedStart)}</Text> : null}
      {offer.message ? <Text style={s.offerMsg}>{offer.message}</Text> : null}
      {pending && !isArtist && (
        <View style={s.actions}>
          <PrimaryBtn label="Accept" onPress={onAccept} disabled={busy} />
          <SecondaryBtn label="Decline" onPress={onDecline} disabled={busy} />
        </View>
      )}
      {pending && isArtist && <SecondaryBtn label="Withdraw offer" onPress={onWithdraw} disabled={busy} />}
    </View>
  );
}

function ArtistOfferComposer({ req, onSent }: { req: AppointmentRequestView; onSent: () => Promise<void> }) {
  const [duration, setDuration] = useState(120);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<{ start: string; end: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!picked || !price) { Alert.alert("Add a time and price", "Pick a slot and enter a price to send your offer."); return; }
    setBusy(true);
    try {
      await createOffer(supabase, {
        requestId: req.id,
        proposedStart: picked.start,
        proposedEnd: picked.end,
        priceAmount: Number(price),
        message: message.trim() || null,
      });
      await onSent();
    } catch (e) {
      Alert.alert("Could not send offer", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.composer}>
      <Text style={s.sectionTitle}>Send an offer</Text>
      <Text style={s.label}>Session length</Text>
      <View style={s.chipWrap}>
        {DURATIONS.map((d) => (
          <Pressable key={d.minutes} style={[s.durChip, duration === d.minutes && s.durChipActive]} onPress={() => { setDuration(d.minutes); setPicked(null); }}>
            <Text style={[s.durChipText, duration === d.minutes && s.durChipTextActive]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Propose a time</Text>
      <SlotPicker artistId={req.artistId} durationMinutes={duration} onPick={(start, end) => setPicked({ start, end })} selectedStart={picked?.start} />

      <Text style={s.label}>Price estimate (€)</Text>
      <TextInput style={s.input} keyboardType="number-pad" value={price} onChangeText={setPrice} placeholder="0" />
      <Text style={s.priceNote}>An indicative quote — payment is arranged directly with the client, not through Inkora.</Text>
      <Text style={s.label}>Message</Text>
      <TextInput style={[s.input, s.multiline]} value={message} onChangeText={setMessage} placeholder="Anything the client should know" multiline />

      <PrimaryBtn label={busy ? "Sending…" : "Send offer"} onPress={send} disabled={busy} />
    </View>
  );
}

// ---------------------------------------------------------------- slot picker
function SlotPicker({ artistId, durationMinutes, onPick, onCancel, selectedStart }: {
  artistId: string; durationMinutes: number;
  onPick: (start: string, end: string) => void; onCancel?: () => void; selectedStart?: string;
}) {
  const availabilityQ = useArtistAvailability(supabase, artistId);
  const enabledWeekdays = useMemo(() => Array.from(new Set((availabilityQ.data ?? []).map((a) => a.dayOfWeek))), [availabilityQ.data]);
  const [date, setDate] = useState<string | null>(null);
  const slotsQ = useArtistDaySlots(supabase, artistId, date ?? "", durationMinutes);

  useEffect(() => { /* reset selection when duration changes handled by parent */ }, [durationMinutes]);

  return (
    <View style={s.slotPicker}>
      <MonthCalendar selected={date} onSelect={setDate} enabledWeekdays={enabledWeekdays.length ? enabledWeekdays : undefined} />
      {date && (
        slotsQ.isLoading ? <ActivityIndicator style={{ marginTop: 8 }} /> :
        (slotsQ.data ?? []).length === 0 ? <Text style={s.muted}>No open slots that day.</Text> :
        <View style={s.chipWrap}>
          {(slotsQ.data ?? []).map((iso) => {
            const end = new Date(new Date(iso).getTime() + durationMinutes * 60000).toISOString();
            const active = selectedStart === iso;
            return (
              <Pressable key={iso} style={[s.slotChip, active && s.slotChipActive]} onPress={() => onPick(iso, end)}>
                <Text style={[s.slotChipText, active && s.slotChipTextActive]}>{fmtTime(iso)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {onCancel && <SecondaryBtn label="Cancel" onPress={onCancel} />}
    </View>
  );
}

// ---------------------------------------------------------------- small bits
function InfoRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={18} color="#71717A" />
      <Text style={s.infoText}>{label}</Text>
    </View>
  );
}
function Tag({ text }: { text: string }) {
  return <View style={s.tag}><Text style={s.tagText}>{text}</Text></View>;
}
function SignedThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let ok = true;
    void getChatSignedUrl(supabase, path).then((u) => ok && setUrl(u ?? undefined));
    return () => { ok = false; };
  }, [path]);
  return url ? <Image source={{ uri: url }} style={s.thumb} contentFit="cover" /> : <View style={[s.thumb, { backgroundColor: "#E4E4E7" }]} />;
}
function PrimaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[s.primary, disabled && s.disabled]} disabled={disabled} onPress={onPress}><Text style={s.primaryText}>{label}</Text></Pressable>;
}
function SecondaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[s.secondary, disabled && s.disabled]} disabled={disabled} onPress={onPress}><Text style={s.secondaryText}>{label}</Text></Pressable>;
}
function DangerBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[s.danger, disabled && s.disabled]} disabled={disabled} onPress={onPress}><Text style={s.dangerText}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  muted: { color: "#A1A1AA" },
  flex1: { flex: 1 },
  partyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  partyName: { fontSize: 18, fontWeight: "800" },
  infoCard: { backgroundColor: "#F9FAFB", borderRadius: 16, padding: 14, gap: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 15, fontWeight: "600", color: "#18181B" },
  reqTitle: { fontSize: 20, fontWeight: "800" },
  reqBody: { fontSize: 15, color: "#3F3F46", lineHeight: 21 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontWeight: "600", color: "#52525B", fontSize: 13 },
  refs: { gap: 8, paddingVertical: 4 },
  thumb: { width: 96, height: 96, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 6 },
  offerCard: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 16, padding: 14, gap: 6 },
  offerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  offerPrice: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  offerLine: { fontSize: 14, color: "#3F3F46" },
  offerMsg: { fontSize: 14, color: "#3F3F46", fontStyle: "italic", marginTop: 4 },
  composer: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 16, padding: 14, gap: 8 },
  label: { fontWeight: "700", fontSize: 13, color: "#52525B", marginTop: 8 },
  priceNote: { color: "#A1A1AA", fontSize: 12, marginTop: 4 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginTop: 4 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  durChip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  durChipActive: { backgroundColor: "#18181B", borderColor: "#18181B" },
  durChipText: { fontWeight: "700", color: "#18181B", fontSize: 13 },
  durChipTextActive: { color: "#fff" },
  slotPicker: { borderTopWidth: 1, borderTopColor: "#F4F4F5", paddingTop: 8, gap: 6 },
  slotChip: { borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  slotChipActive: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  slotChipText: { fontWeight: "700", color: "#18181B" },
  slotChipTextActive: { color: "#fff" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  primary: { flex: 1, minWidth: 120, backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondary: { flex: 1, minWidth: 120, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  secondaryText: { color: "#18181B", fontWeight: "700", fontSize: 15 },
  danger: { borderWidth: 1, borderColor: "#FECACA", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  dangerText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.4 },
});
