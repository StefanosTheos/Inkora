import { Ionicons } from "@expo/vector-icons";
import { replyToReview } from "@inkora/data-access";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "../lib/supabase";
import { useToast } from "./Toast";

/** Shows a review's public reply and, when `canReply`, an inline editor to add /
 *  edit it. `onReplied` refreshes the list after a save. */
export function ReviewReply({ reviewId, reply, canReply, onReplied }: {
  reviewId: string;
  reply: string | null;
  canReply: boolean;
  onReplied: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await replyToReview(supabase, reviewId, text.trim());
      setEditing(false);
      onReplied();
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <View style={s.editWrap}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Write a public reply…"
          placeholderTextColor="#A1A1AA"
          multiline
          autoFocus
          accessibilityLabel="Reply to review"
        />
        <View style={s.editActions}>
          <Pressable onPress={() => { setText(reply ?? ""); setEditing(false); }} hitSlop={6} accessibilityRole="button" accessibilityLabel="Cancel reply">
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => void save()} disabled={busy} style={[s.saveBtn, busy && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Post reply">
            <Text style={s.saveText}>{busy ? "…" : reply ? "Save" : "Reply"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (reply) {
    return (
      <View style={s.replyBox}>
        <View style={s.replyHead}>
          <Ionicons name="arrow-undo-outline" size={13} color="#71717A" />
          <Text style={s.replyLabel}>Response</Text>
          {canReply ? (
            <Pressable onPress={() => { setText(reply); setEditing(true); }} hitSlop={6} accessibilityRole="button" accessibilityLabel="Edit reply">
              <Text style={s.edit}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={s.replyText}>{reply}</Text>
      </View>
    );
  }

  if (canReply) {
    return (
      <Pressable onPress={() => { setText(""); setEditing(true); }} hitSlop={6} style={s.replyCta} accessibilityRole="button" accessibilityLabel="Reply to this review">
        <Ionicons name="arrow-undo-outline" size={14} color="#E5484D" />
        <Text style={s.replyCtaText}>Reply</Text>
      </Pressable>
    );
  }
  return null;
}

const s = StyleSheet.create({
  replyBox: { marginTop: 8, marginLeft: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#E4E4E7" },
  replyHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  replyLabel: { flex: 1, color: "#71717A", fontSize: 12, fontWeight: "800" },
  edit: { color: "#E5484D", fontSize: 12, fontWeight: "700" },
  replyText: { color: "#3F3F46", fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  replyCta: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 8, paddingVertical: 2 },
  replyCtaText: { color: "#E5484D", fontWeight: "800", fontSize: 13 },
  editWrap: { marginTop: 8 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 60, textAlignVertical: "top" },
  editActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 14, marginTop: 8 },
  cancel: { color: "#71717A", fontWeight: "700", fontSize: 14 },
  saveBtn: { backgroundColor: "#18181B", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
