import { Ionicons } from "@expo/vector-icons";
import { dashboardKeys, publicStorageUrl, rewardKeys, updateMyProfile, uploadAvatar, useProfileSummary } from "@inkora/data-access";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../../components/Toast";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const img = (p?: string | null) => (p ? publicStorageUrl(env.SUPABASE_URL, p) : undefined);

export function EditProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useProfileSummary(supabase);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile.data && !hydrated) {
      setDisplayName(profile.data.displayName ?? "");
      setUsername(profile.data.username ?? "");
      setCity(profile.data.city ?? "");
      setBio(profile.data.bio ?? "");
      setAvatarPath(profile.data.avatarPath ?? null);
      setHydrated(true);
    }
  }, [profile.data, hydrated]);

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploadingAvatar(true);
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      const path = await uploadAvatar(supabase, buf, asset.mimeType ?? "image/jpeg", ext);
      await updateMyProfile(supabase, { avatarPath: path });
      setAvatarPath(path);
      await Promise.all([
        qc.invalidateQueries({ queryKey: dashboardKeys.profile }),
        qc.invalidateQueries({ queryKey: rewardKeys.completion }),
        qc.invalidateQueries({ queryKey: rewardKeys.account }),
      ]);
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    if (!displayName.trim()) { toast.show("Please enter a display name", "error"); return; }
    if (username.trim() && !USERNAME_RE.test(username.trim())) {
      toast.show("Username: 3–30 lowercase letters, numbers or underscores", "error");
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile(supabase, { displayName, username, city, bio });
      await Promise.all([
        qc.invalidateQueries({ queryKey: dashboardKeys.profile }),
        qc.invalidateQueries({ queryKey: rewardKeys.completion }),
        qc.invalidateQueries({ queryKey: rewardKeys.account }),
      ]);
      toast.show("Profile updated");
    } catch (e) {
      const msg = (e as Error).message;
      toast.show(/username/i.test(msg) ? "That username is taken or invalid." : msg, "error");
    } finally {
      setSaving(false);
    }
  }

  const avatarUrl = img(avatarPath);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle}>Edit profile</Text>
        <View style={{ width: 26 }} />
      </View>

      {profile.isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {/* Avatar */}
            <View style={s.avatarWrap}>
              <Pressable style={s.avatar} onPress={pickAvatar} disabled={uploadingAvatar}>
                {uploadingAvatar ? (
                  <ActivityIndicator color="#fff" />
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatarImg} contentFit="cover" />
                ) : (
                  <Text style={s.avatarInitial}>{(displayName || "?").charAt(0).toUpperCase()}</Text>
                )}
                <View style={s.camBadge}><Ionicons name="camera" size={15} color="#fff" /></View>
              </Pressable>
              <Pressable onPress={pickAvatar} disabled={uploadingAvatar}>
                <Text style={s.avatarAction}>{avatarUrl ? "Change photo" : "Add profile pic"}</Text>
              </Pressable>
            </View>

            <Field label="Display name">
              <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" />
            </Field>
            <Field label="Username" hint="Lowercase letters, numbers, underscores">
              <TextInput style={s.input} value={username} autoCapitalize="none" onChangeText={(t) => setUsername(t.toLowerCase())} placeholder="username" />
            </Field>
            <Field label="City">
              <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="e.g. Athens" />
            </Field>
            <Field label="Bio">
              <TextInput style={[s.input, s.multiline]} value={bio} onChangeText={setBio} placeholder="A little about you" multiline />
            </Field>

            <Pressable style={[s.saveBtn, saving && s.disabled]} disabled={saving} onPress={save}>
              <Text style={s.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 16 },
  avatarWrap: { alignItems: "center", gap: 8, marginBottom: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontSize: 40, fontWeight: "800" },
  camBadge: { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  avatarAction: { color: "#E5484D", fontWeight: "700", fontSize: 14 },
  field: { marginBottom: 14 },
  label: { fontWeight: "700", fontSize: 13, color: "#52525B", marginBottom: 6 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  hint: { color: "#A1A1AA", fontSize: 12, marginTop: 4 },
  saveBtn: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
});
