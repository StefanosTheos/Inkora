import { Ionicons } from "@expo/vector-icons";
import { getChatSignedUrl, publicStorageUrl, uploadChatFile, useAuth, useChat, useConversations } from "@inkora/data-access";
import { type ArtistId, type ConversationId, type Message, messageKind } from "@inkora/domain";
import { analytics } from "../../lib/analytics";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);

export function ChatThreadScreen({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ctx } = useAuth();
  const meId = ctx.userId;
  const chat = useChat(supabase, conversationId, meId);
  const convs = useConversations(supabase);
  const conv = convs.data?.find((c) => c.id === conversationId);
  const title = conv?.otherName ?? "Chat";
  const avatarUrl = img(conv?.otherAvatarPath);

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
    if (now - lastTyping.current > 1500) { chat.sendTyping(); lastTyping.current = now; }
  };
  const onSend = () => {
    if (!text.trim()) return;
    const isFirst = chat.messages.length === 0;
    chat.sendText(text.trim());
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
      chat.sendImage(path);
    } catch (e) {
      Alert.alert("Upload failed", (e as Error).message);
    }
  }

  async function startRecording() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) { Alert.alert("Microphone needed", "Enable mic access to send voice messages."); return; }
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
      chat.sendVoice(path, durationMs);
    } catch (e) {
      Alert.alert("Upload failed", (e as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <View style={s.headerAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.headerAvatarImg} contentFit="cover" />
          ) : (
            <Text style={s.headerAvatarInitial}>{title.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
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
          <Pressable style={s.actionBtn} onPress={() => { chat.sendQuote({ description: text.trim() || undefined }); setText(""); setShowActions(false); }}>
            <Text style={s.actionText}>💬 Request quote</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={() => { chat.sendConsultation({ note: text.trim() || undefined }); setText(""); setShowActions(false); }}>
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

function VoicePlayer({ path, durationMs, mine }: { path?: string; durationMs: number; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  useEffect(() => () => { void soundRef.current?.unloadAsync(); }, []);
  async function toggle() {
    if (!path) return;
    if (playing) { await soundRef.current?.pauseAsync(); setPlaying(false); return; }
    if (!soundRef.current) {
      const url = await getChatSignedUrl(supabase, path);
      if (!url) return;
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
        if (st.isLoaded && st.didJustFinish) { setPlaying(false); void sound.setPositionAsync(0); }
      });
    }
    await soundRef.current.playAsync();
    setPlaying(true);
  }
  const color = mine ? "#fff" : "#18181B";
  return (
    <Pressable style={s.voice} onPress={toggle}>
      <Ionicons name={playing ? "pause" : "play"} size={20} color={color} />
      <View style={[s.voiceBar, { backgroundColor: mine ? "rgba(255,255,255,0.4)" : "#D4D4D8" }]} />
      <Text style={{ color, fontWeight: "600" }}>{mmss(durationMs)}</Text>
    </Pressable>
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

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
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
  voice: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 140 },
  voiceBar: { flex: 1, height: 3, borderRadius: 2 },
  reqCard: { minWidth: 180 },
  reqTitle: { fontWeight: "800", fontSize: 15 },
  reqDetail: { marginTop: 4, fontSize: 13 },
  receipt: { fontSize: 11, color: "#A1A1AA", alignSelf: "flex-end", marginTop: 2, marginRight: 4 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtn: { backgroundColor: "#F4F4F5", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  actionText: { fontWeight: "600", fontSize: 13 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  input: { flex: 1, maxHeight: 100, backgroundColor: "#F4F4F5", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
});
