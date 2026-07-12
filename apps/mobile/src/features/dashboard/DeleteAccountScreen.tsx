import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";

/**
 * Deliberately-hard-to-reach account deletion. Lives behind a muted link at the
 * bottom of Account settings so it takes intent to get here; this page spells
 * out the consequences before the final, confirmed action.
 */
export function DeleteAccountScreen() {
  const router = useRouter();
  const confirm = useConfirm();

  function onDelete() {
    void confirm({
      title: "Delete account?",
      message: "This permanently removes your profile, bookings and saved items. This can’t be undone. For the demo, contact support to complete deletion.",
      confirmLabel: "Delete",
      cancelLabel: "Keep my account",
      destructive: true,
    }).then((ok) => { if (ok) void Linking.openURL("mailto:support@inkora.app?subject=Delete%20my%20account"); });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">Delete account</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.iconWrap}><Ionicons name="warning-outline" size={30} color="#DC2626" /></View>
        <Text style={s.title}>This permanently deletes your account</Text>
        <Text style={s.para}>Deleting your account removes:</Text>
        <View style={s.list}>
          <Bullet text="Your profile, photo and details" />
          <Bullet text="Your bookings, requests and chat history" />
          <Bullet text="Saved artists, designs and rewards points" />
        </View>
        <Text style={s.para}>This can’t be undone. If you just need a break, you can sign out instead and come back anytime.</Text>
        <Text style={s.note}>For the demo, deletion is completed by our support team — the button below opens an email request.</Text>
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={s.deleteBtn} onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete my account">
          <Text style={s.deleteText}>Delete my account</Text>
        </Pressable>
        <Pressable style={s.cancelBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Keep my account">
          <Text style={s.cancelText}>Keep my account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bullet}>
      <Ionicons name="close-circle" size={18} color="#DC2626" />
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 20, gap: 14 },
  iconWrap: { alignSelf: "flex-start", width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  para: { fontSize: 15, color: "#3F3F46", lineHeight: 21 },
  list: { gap: 10 },
  bullet: { flexDirection: "row", alignItems: "center", gap: 10 },
  bulletText: { flex: 1, fontSize: 15, color: "#3F3F46" },
  note: { fontSize: 13, color: "#A1A1AA", lineHeight: 19 },
  footer: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: "#F4F4F5" },
  deleteBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  deleteText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cancelBtn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  cancelText: { color: "#18181B", fontWeight: "700", fontSize: 15 },
});
