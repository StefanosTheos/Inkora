import { Ionicons } from "@expo/vector-icons";
import {
  bookingKeys, declineRequest, getChatSignedUrl, markEntityNotificationsRead, publicStorageUrl,
  respondToOffer, uploadChatFile, useAuth, useChat, useConversations, useOfferStatus,
} from "@inkora/data-access";
import { type ArtistId, type ConversationId, type Message, messageKind } from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, PanResponder, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { analytics } from "../../lib/analytics";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtDateTime, money } from "../booking/components/ui";
import { OfferComposerSheet } from "../booking/OfferComposerSheet";

const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);

export function ChatThreadScreen({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { ctx } = useAuth();
  const meId = ctx.userId;
  const chat = useChat(supabase, conversationId, meId);
  const convs = useConversations(supabase);
  const conv = convs.data?.find((c) => c.id === conversationId);
  const title = conv?.otherName ?? "Chat";
  const avatarUrl = img(conv?.otherAvatarPath);
  // Tapping the header opens the studio (studio chats) or artist (direct chats)
  // profile. Support conversations have no profile to open.
  const canOpenProfile = !!(conv?.studioSlug || (conv?.type === "direct" && conv?.otherId));
  const openProfile = () => {
    if (conv?.studioSlug) router.push(`/studio/${conv.studioSlug}`);
    else if (conv?.type === "direct" && conv?.otherId) router.push(`/artist/${conv.otherId}`);
  };

  const [text, setText] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recStart = useRef(0);
  const lastTyping = useRef(0);

  const data = useMemo(() => [...chat.messages].reverse(), [chat.messages]); // newest-first for inverted list
  const lastMineId = useMemo(() => data.find((m) => m.senderId === meId)?.id, [data, meId]);
  const seen = !!(chat.otherReadAt && lastMineId && (() => {
    const lm = chat.messages.find((m) => m.id === lastMineId);
    return lm ? new Date(lm.createdAt) <= new Date(chat.otherReadAt!) : false;
  })());

  const onChange = (t: string) => {
    setText(t);
    const now = Date.now();
    if (now - lastTyping.current > 1500) { void chat.sendTyping(); lastTyping.current = now; }
  };
  const onSend = () => {
    if (!text.trim()) return;
    const isFirst = chat.messages.length === 0;
    void chat.sendText(text.trim());
    setText("");
    analytics.capture({ name: "message_sent", props: { conversationId: conversationId as ConversationId } }, ctx);
    if (isFirst && conv?.otherId) {
      analytics.capture({ name: "first_message_sent", props: { conversationId: conversationId as ConversationId, artistId: conv.otherId as unknown as ArtistId } }, ctx);
    }
  };

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      const path = await uploadChatFile(supabase, conversationId, buf, asset.mimeType ?? "image/jpeg", ext);
      void chat.sendImage(path);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  async function startRecording() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) { toast.show("Enable mic access to send voice messages", "error"); return; }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recStart.current = Date.now();
    setRecording(rec);
  }
  async function stopRecording() {
    if (!recording) return;
    const durationMs = Date.now() - recStart.current;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (!uri) return;
    try {
      const buf = await (await fetch(uri)).arrayBuffer();
      const path = await uploadChatFile(supabase, conversationId, buf, "audio/m4a", "m4a");
      void chat.sendVoice(path, durationMs);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Pressable
          style={s.headerPerson}
          onPress={openProfile}
          disabled={!canOpenProfile}
          accessibilityRole={canOpenProfile ? "button" : undefined}
          accessibilityLabel={canOpenProfile ? `View ${title}'s profile` : title}
        >
          <View style={s.headerAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.headerAvatarImg} contentFit="cover" />
            ) : (
              <Text style={s.headerAvatarInitial}>{title.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        </Pressable>
      </View>

      {chat.isLoading ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : data.length === 0 ? (
        <View style={s.center}><Text style={s.emptyText}>Say hello 👋</Text></View>
      ) : (
        <FlatList
          style={s.flex}
          data={data}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Bubble message={item} mine={item.senderId === meId} isLastMine={item.id === lastMineId} seen={seen} />
          )}
          ListHeaderComponent={chat.typingOther ? <View style={s.typing}><Text style={s.typingText}>typing…</Text></View> : null}
        />
      )}

      {showActions && (
        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={() => { void chat.sendQuote({ description: text.trim() || undefined }); setText(""); setShowActions(false); }}>
            <Text style={s.actionText}>💬 Request quote</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={() => { void chat.sendConsultation({ note: text.trim() || undefined }); setText(""); setShowActions(false); }}>
            <Text style={s.actionText}>📅 Request consultation</Text>
          </Pressable>
        </View>
      )}

      <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable onPress={() => setShowActions((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel="More actions"><Ionicons name="add-circle-outline" size={26} color="#71717A" /></Pressable>
        <Pressable onPress={pickImage} hitSlop={8} accessibilityRole="button" accessibilityLabel="Attach photo"><Ionicons name="image-outline" size={24} color="#71717A" /></Pressable>
        <TextInput style={s.input} placeholder={recording ? "Recording…" : "Message"} value={text} onChangeText={onChange} multiline editable={!recording} />
        {text.trim().length > 0 ? (
          <Pressable onPress={onSend} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send message"><Ionicons name="send" size={22} color="#E5484D" /></Pressable>
        ) : (
          <Pressable onPress={recording ? stopRecording : startRecording} hitSlop={8} accessibilityRole="button" accessibilityLabel={recording ? "Stop recording" : "Record voice message"}>
            <Ionicons name={recording ? "stop-circle" : "mic"} size={26} color={recording ? "#E5484D" : "#71717A"} />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, mine, isLastMine, seen }: { message: Message; mine: boolean; isLastMine: boolean; seen: boolean }) {
  const kind = messageKind(message);
  return (
    <View style={[s.bubbleWrap, mine ? s.right : s.left]}>
      <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther, (kind === "image") && s.bubbleImage]}>
        {kind === "text" && <Text style={mine ? s.textMine : s.textOther}>{message.body}</Text>}
        {kind === "image" && <ChatImage path={message.attachments[0]?.path} />}
        {kind === "voice" && <VoicePlayer path={message.attachments[0]?.path} durationMs={message.attachments[0]?.durationMs ?? 0} mine={mine} />}
        {(kind === "quote" || kind === "consultation") && <RequestCard message={message} kind={kind} mine={mine} />}
        {kind === "booking_request" && <BookingRequestCard message={message} mine={mine} />}
        {kind === "offer" && <BookingOfferCard message={message} mine={mine} />}
        {kind === "appointment" && <BookingApptCard message={message} mine={mine} />}
      </View>
      {mine && isLastMine && <Text style={s.receipt}>{seen ? "Seen" : "Sent"}</Text>}
    </View>
  );
}

function ChatImage({ path }: { path?: string }) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let ok = true;
    if (path) void getChatSignedUrl(supabase, path).then((u) => ok && setUrl(u ?? undefined));
    return () => { ok = false; };
  }, [path]);
  return url ? <Image source={{ uri: url }} style={s.chatImg} contentFit="cover" /> : <View style={[s.chatImg, { backgroundColor: "#E4E4E7" }]} />;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

function VoicePlayer({ path, durationMs, mine }: { path?: string; durationMs: number; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);          // current playback position (ms)
  const [dur, setDur] = useState(durationMs); // real duration once loaded (ms)
  const [seekFrac, setSeekFrac] = useState<number | null>(null); // 0..1 while dragging
  const soundRef = useRef<Audio.Sound | null>(null);
  const barWidth = useRef(0);
  const seekingRef = useRef(false);

  useEffect(() => () => { void soundRef.current?.unloadAsync(); }, []);

  const onStatus = (st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    if (st.durationMillis) setDur(st.durationMillis);
    if (st.didJustFinish) {
      // Stop cleanly and rewind. Pause FIRST so shouldPlay is cleared before
      // rewinding — rewinding while shouldPlay is still true is what made it
      // loop forever.
      setPlaying(false);
      setPos(0);
      void soundRef.current?.pauseAsync().then(() => soundRef.current?.setPositionAsync(0));
      return;
    }
    if (!seekingRef.current) setPos(st.positionMillis ?? 0);
  };

  async function load(): Promise<Audio.Sound | null> {
    if (soundRef.current) return soundRef.current;
    if (!path) return null;
    const url = await getChatSignedUrl(supabase, path);
    if (!url) return null;
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { progressUpdateIntervalMillis: 100 },
      onStatus,
    );
    soundRef.current = sound;
    return sound;
  }

  async function toggle() {
    const sound = await load();
    if (!sound) return;
    if (playing) { await sound.pauseAsync(); setPlaying(false); return; }
    await sound.playAsync();
    setPlaying(true);
  }

  async function seekTo(frac: number) {
    const sound = await load();
    const total = dur || durationMs;
    if (!sound || total <= 0) return;
    const target = clamp01(frac) * total;
    setPos(target);
    await sound.setPositionAsync(target);
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          seekingRef.current = true;
          setSeekFrac(clamp01(e.nativeEvent.locationX / (barWidth.current || 1)));
        },
        onPanResponderMove: (e) => {
          setSeekFrac(clamp01(e.nativeEvent.locationX / (barWidth.current || 1)));
        },
        onPanResponderRelease: (e) => {
          const frac = clamp01(e.nativeEvent.locationX / (barWidth.current || 1));
          seekingRef.current = false;
          setSeekFrac(null);
          void seekTo(frac);
        },
        onPanResponderTerminate: () => { seekingRef.current = false; setSeekFrac(null); },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dur, durationMs, path],
  );

  const color = mine ? "#fff" : "#18181B";
  const trackBg = mine ? "rgba(255,255,255,0.35)" : "#D4D4D8";
  const fillBg = mine ? "#fff" : "#18181B";
  const effDur = dur || durationMs || 0;
  const frac = seekFrac != null ? seekFrac : effDur > 0 ? clamp01(pos / effDur) : 0;
  const shownMs = seekFrac != null ? seekFrac * effDur : playing || pos > 0 ? pos : effDur;

  return (
    <View style={s.voice}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}>
        <Ionicons name={playing ? "pause" : "play"} size={22} color={color} />
      </Pressable>
      <View
        style={s.voiceTrackHit}
        onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Voice message progress"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(frac * 100) }}
      >
        <View style={[s.voiceTrack, { backgroundColor: trackBg }]}>
          <View style={[s.voiceFill, { width: `${frac * 100}%`, backgroundColor: fillBg }]} />
        </View>
        <View style={[s.voiceThumb, { left: `${frac * 100}%`, backgroundColor: fillBg }]} />
      </View>
      <Text style={[s.voiceTime, { color }]}>{mmss(shownMs)}</Text>
    </View>
  );
}

function RequestCard({ message, kind, mine }: { message: Message; kind: "quote" | "consultation"; mine: boolean }) {
  const md = message.metadata as Record<string, string | undefined>;
  const color = mine ? "#fff" : "#18181B";
  const details = kind === "quote"
    ? [md.placement, md.size, md.description].filter(Boolean).join(" · ")
    : [md.note, md.preferredDate].filter(Boolean).join(" · ");
  return (
    <View style={s.reqCard}>
      <Text style={[s.reqTitle, { color }]}>{kind === "quote" ? "💬 Quote request" : "📅 Consultation request"}</Text>
      {details ? <Text style={[s.reqDetail, { color: mine ? "rgba(255,255,255,0.85)" : "#52525B" }]}>{details}</Text> : null}
    </View>
  );
}

interface BookingReqMeta {
  requestId?: string; artistId?: string; title?: string; placement?: string | null;
  size?: string | null; isColor?: boolean | null; preferredDate?: string | null;
  budgetMin?: number | null; budgetMax?: number | null;
}

interface OfferMeta {
  offerId?: string; requestId?: string; artistId?: string;
  proposedStart?: string | null; priceAmount?: number | null; currencyCode?: string | null; message?: string | null;
}
interface ApptMeta { appointmentId?: string; proposedStart?: string | null; priceAmount?: number | null }

/** Snapshot of a booking request in the chat. The artist gets quick actions. */
function BookingRequestCard({ message, mine }: { message: Message; mine: boolean }) {
  const router = useRouter();
  const { ctx } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [composer, setComposer] = useState<{ open: boolean; prefill: string | null }>({ open: false, prefill: null });
  const md = (message.metadata ?? {}) as BookingReqMeta;
  const requestId = md.requestId ?? "";
  const isArtist = !!ctx.userId && ctx.userId === md.artistId;
  const color = mine ? "#fff" : "#18181B";
  const sub = mine ? "rgba(255,255,255,0.85)" : "#52525B";
  const detail = [
    md.placement,
    md.size,
    md.isColor == null ? null : md.isColor ? "Color" : "Black & grey",
    md.preferredDate ? `Prefers ${fmtDate(md.preferredDate)}` : null,
    md.budgetMin || md.budgetMax ? `Budget ${money(md.budgetMin ?? null, "EUR")}–${money(md.budgetMax ?? null, "EUR")}` : null,
  ].filter(Boolean).join(" · ");

  async function onDecline() {
    const ok = await confirm({ title: "Decline request?", message: "The client will be notified.", confirmLabel: "Decline", cancelLabel: "Keep", destructive: true });
    if (!ok) return;
    setBusy(true);
    try {
      await declineRequest(supabase, requestId);
      await qc.invalidateQueries({ queryKey: bookingKeys.artistRequests });
      await qc.invalidateQueries({ queryKey: bookingKeys.request(requestId) });
      toast.show("Request declined");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable style={s.reqCard} onPress={() => { if (requestId) router.push(`/booking/${requestId}`); }} accessibilityRole="button" accessibilityLabel="View booking request">
      <Text style={[s.reqTitle, { color }]}>📩 Booking request</Text>
      {md.title ? <Text style={[s.bookingReqName, { color }]} numberOfLines={2}>{md.title}</Text> : null}
      {detail ? <Text style={[s.reqDetail, { color: sub }]}>{detail}</Text> : null}
      {isArtist ? (
        <View style={s.bookingReqActions}>
          <Pressable style={[s.brBtn, s.brPrimary]} onPress={() => setComposer({ open: true, prefill: md.preferredDate ?? null })} disabled={busy} accessibilityRole="button" accessibilityLabel="Accept and send an offer"><Text style={s.brPrimaryText}>Accept</Text></Pressable>
          <Pressable style={[s.brBtn, s.brSecondary]} onPress={() => setComposer({ open: true, prefill: null })} disabled={busy} accessibilityRole="button" accessibilityLabel="Edit and send an offer"><Text style={s.brSecondaryText}>Edit</Text></Pressable>
          <Pressable style={[s.brBtn, s.brSecondary]} onPress={onDecline} disabled={busy} accessibilityRole="button" accessibilityLabel="Decline request"><Text style={[s.brSecondaryText, { color: "#E5484D" }]}>Decline</Text></Pressable>
        </View>
      ) : null}
      {isArtist ? (
        <OfferComposerSheet
          visible={composer.open}
          requestId={requestId}
          artistId={md.artistId ?? ""}
          prefillDate={composer.prefill}
          onClose={() => setComposer({ open: false, prefill: null })}
          onSent={() => toast.show("Offer sent")}
        />
      ) : null}
    </Pressable>
  );
}

function offerStatusLabel(status: string, isArtist: boolean): string {
  switch (status) {
    case "pending": return isArtist ? "Waiting for the client to respond" : "Awaiting your response";
    case "accepted": return "Accepted ✓";
    case "declined": return "Declined";
    case "withdrawn": return "Withdrawn";
    case "expired": return "Expired";
    default: return status;
  }
}

/** Offer snapshot in the chat. The client can Accept/Decline while it's pending. */
function BookingOfferCard({ message, mine }: { message: Message; mine: boolean }) {
  const router = useRouter();
  const { ctx } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const md = (message.metadata ?? {}) as OfferMeta;
  const offerId = md.offerId ?? "";
  const isArtist = !!ctx.userId && ctx.userId === md.artistId;
  const status = useOfferStatus(supabase, offerId).data ?? "pending";
  const color = mine ? "#fff" : "#18181B";
  const sub = mine ? "rgba(255,255,255,0.85)" : "#52525B";
  const line = [
    md.proposedStart ? fmtDateTime(md.proposedStart) : null,
    md.priceAmount != null ? money(md.priceAmount, md.currencyCode ?? "EUR") : null,
  ].filter(Boolean).join(" · ");

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      const apptId = await respondToOffer(supabase, offerId, accept);
      // Responding to the offer clears its "new offer" notification, so the
      // seeker's offer badges (Requests tab + Upcoming "See all") count down.
      await markEntityNotificationsRead(supabase, "offer", offerId);
      // Accepting converts the request into an appointment; decline closes it.
      // Refresh every view that reflects that transition so the request leaves
      // the Requests tab and the booking shows up (Scheduled) under Upcoming.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["offer-status", offerId] }),
        qc.invalidateQueries({ queryKey: bookingKeys.appointments }),
        qc.invalidateQueries({ queryKey: bookingKeys.clientRequests }),
        qc.invalidateQueries({ queryKey: bookingKeys.artistRequests }),
        md.requestId ? qc.invalidateQueries({ queryKey: bookingKeys.request(md.requestId) }) : Promise.resolve(),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      if (accept && apptId) router.push(`/booking/${apptId}`);
      else toast.show("Offer declined");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.reqCard}>
      <Text style={[s.reqTitle, { color }]}>🏷️ Offer</Text>
      {line ? <Text style={[s.bookingReqName, { color }]}>{line}</Text> : null}
      {md.message ? <Text style={[s.reqDetail, { color: sub }]}>{md.message}</Text> : null}
      {status === "pending" && !isArtist ? (
        <View style={s.bookingReqActions}>
          <Pressable style={[s.brBtn, s.brPrimary]} onPress={() => respond(true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Accept offer"><Text style={s.brPrimaryText}>Accept</Text></Pressable>
          <Pressable style={[s.brBtn, s.brSecondary]} onPress={() => respond(false)} disabled={busy} accessibilityRole="button" accessibilityLabel="Decline offer"><Text style={[s.brSecondaryText, { color: "#E5484D" }]}>Decline</Text></Pressable>
        </View>
      ) : (
        <>
          <Text style={[s.reqDetail, { color: sub, marginTop: 8, fontWeight: "700" }]}>{offerStatusLabel(status, isArtist)}</Text>
          {/* Client declined this offer — let the artist propose a fresh one. */}
          {isArtist && status === "declined" ? (
            <View style={[s.bookingReqActions, { justifyContent: "center" }]}>
              <Pressable style={[s.brBtn, s.brSecondary]} onPress={() => setComposerOpen(true)} accessibilityRole="button" accessibilityLabel="Make a new offer"><Text style={[s.brSecondaryText, { color: "#E5484D" }]}>Make a new offer</Text></Pressable>
            </View>
          ) : null}
        </>
      )}
      {isArtist ? (
        <OfferComposerSheet
          visible={composerOpen}
          requestId={md.requestId ?? ""}
          artistId={md.artistId ?? ""}
          prefillDate={md.proposedStart ? md.proposedStart.slice(0, 10) : null}
          onClose={() => setComposerOpen(false)}
          onSent={() => toast.show("Offer sent")}
        />
      ) : null}
    </View>
  );
}

/** Confirmed appointment snapshot in the chat. */
function BookingApptCard({ message, mine }: { message: Message; mine: boolean }) {
  const router = useRouter();
  const md = (message.metadata ?? {}) as ApptMeta;
  const color = mine ? "#fff" : "#18181B";
  const sub = mine ? "rgba(255,255,255,0.85)" : "#52525B";
  const line = [
    md.proposedStart ? fmtDateTime(md.proposedStart) : null,
    md.priceAmount != null ? money(md.priceAmount, "EUR") : null,
  ].filter(Boolean).join(" · ");
  return (
    <Pressable style={s.reqCard} onPress={() => { if (md.appointmentId) router.push(`/booking/${md.appointmentId}`); }} accessibilityRole="button" accessibilityLabel="View appointment">
      <Text style={[s.reqTitle, { color }]}>✅ Booking confirmed</Text>
      {line ? <Text style={[s.reqDetail, { color: sub }]}>{line}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerPerson: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  headerAvatarImg: { width: "100%", height: "100%" },
  headerAvatarInitial: { color: "#fff", fontSize: 14, fontWeight: "800" },
  headerTitle: { fontSize: 17, fontWeight: "800", flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#A1A1AA", fontSize: 15 },
  typing: { alignSelf: "flex-start", backgroundColor: "#F4F4F5", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 },
  typingText: { color: "#71717A", fontStyle: "italic" },
  bubbleWrap: { marginVertical: 3, maxWidth: "80%" },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: "#E5484D", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#F4F4F5", borderBottomLeftRadius: 4 },
  bubbleImage: { padding: 3 },
  textMine: { color: "#fff", fontSize: 15 },
  textOther: { color: "#18181B", fontSize: 15 },
  chatImg: { width: 220, height: 220, borderRadius: 14 },
  voice: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 180 },
  voiceTrackHit: { flex: 1, height: 24, justifyContent: "center" }, // tall hit area for dragging
  voiceTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  voiceFill: { height: "100%", borderRadius: 2 },
  voiceThumb: { position: "absolute", width: 12, height: 12, borderRadius: 6, marginLeft: -6, top: 6 },
  voiceTime: { fontWeight: "600", fontVariant: ["tabular-nums"], minWidth: 34, textAlign: "right" },
  reqCard: { minWidth: 180 },
  reqTitle: { fontWeight: "800", fontSize: 15 },
  reqDetail: { marginTop: 4, fontSize: 13 },
  bookingReqName: { fontWeight: "700", fontSize: 14, marginTop: 2 },
  bookingReqActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  brBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  brPrimary: { backgroundColor: "#18181B" },
  brPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  brSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E4E4E7" },
  brSecondaryText: { color: "#18181B", fontWeight: "700", fontSize: 13 },
  receipt: { fontSize: 11, color: "#A1A1AA", alignSelf: "flex-end", marginTop: 2, marginRight: 4 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtn: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  actionText: { fontWeight: "600", fontSize: 13 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  input: { flex: 1, maxHeight: 100, backgroundColor: "#F4F4F5", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
});
