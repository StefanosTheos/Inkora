import { Ionicons } from "@expo/vector-icons";
import { dashboardKeys, publicStorageUrl, rewardKeys, updateArtistProfile, updateMyProfile, updateProfileLocation, uploadAvatar, useArtistProfile, useAuth, useProfileSummary } from "@inkora/data-access";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
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
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const isArtist = ctx.roles.includes("artist");
  const profile = useProfileSummary(supabase);
  const artist = useArtistProfile(supabase, isArtist ? meId : "");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Artist-only fields
  const [headline, setHeadline] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [minCharge, setMinCharge] = useState("");
  const [instagram, setInstagram] = useState("");
  const [accepting, setAccepting] = useState(true);
  const [artistHydrated, setArtistHydrated] = useState(false);

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

  useEffect(() => {
    if (isArtist && artist.data && !artistHydrated) {
      setHeadline(artist.data.headline ?? "");
      setHourlyRate(artist.data.hourlyRate != null ? String(artist.data.hourlyRate) : "");
      setMinCharge(artist.data.minCharge != null ? String(artist.data.minCharge) : "");
      setInstagram(artist.data.instagram ?? "");
      setAccepting(artist.data.isAccepting);
      setArtistHydrated(true);
    }
  }, [isArtist, artist.data, artistHydrated]);

  async function pickAvatar() {
    // No allowsEditing: it opens Android's native crop screen whose confirm
    // button reads "Crop" (misleading for "use this photo"). The avatar renders
    // cover-cropped in a circular frame, so the raw pick looks correct anyway.
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploadingAvatar(true);
    try {
      const buf = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      const path = await uploadAvatar(supabase, buf, asset.mimeType ?? "image/jpeg", ext);
      // Stage the new photo (preview only). It's persisted to the profile when
      // the user taps "Save changes", consistent with the other fields.
      setAvatarPath(path);
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
    const rateBad = hourlyRate.trim() !== "" && Number.isNaN(Number(hourlyRate));
    const minChargeBad = minCharge.trim() !== "" && Number.isNaN(Number(minCharge));
    if (isArtist && (rateBad || minChargeBad)) {
      toast.show("Rate and minimum charge must be numbers", "error");
      return;
    }
    setSaving(true);
    try {
      // Only send username when it actually changed — re-sending the current
      // one needlessly hits the unique check (fails when saving other fields
      // like the "accepting" toggle).
      const usernameChanged = username.trim() !== (profile.data?.username ?? "");
      const avatarChanged = avatarPath !== (profile.data?.avatarPath ?? null);
      await updateMyProfile(supabase, {
        displayName,
        bio,
        username: usernameChanged ? username : undefined,
        avatarPath: avatarChanged ? avatarPath : undefined,
      });
      // City is geocoded to coordinates (owner-only) so Nearby / distance work.
      const loc = await updateProfileLocation(supabase, city.trim());
      if (!loc.ok) throw new Error(loc.error.message);
      const located = loc.value != null;
      if (isArtist && artistHydrated) {
        await updateArtistProfile(supabase, {
          headline: headline.trim() || null,
          hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : null,
          minCharge: minCharge.trim() ? Number(minCharge) : null,
          instagram: instagram.trim().replace(/^@/, "") || null,
          isAccepting: accepting,
        });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: dashboardKeys.profile }),
        qc.invalidateQueries({ queryKey: rewardKeys.completion }),
        qc.invalidateQueries({ queryKey: rewardKeys.account }),
        qc.invalidateQueries({ queryKey: ["my-location"] }),
        qc.invalidateQueries({ queryKey: ["artist", meId] }),
      ]);
      toast.show(
        city.trim() && !located
          ? "Saved — couldn't locate that place for Nearby. Try “City, Country”."
          : "Profile updated",
      );
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
        <Text style={s.headerTitle} accessibilityRole="header">Edit profile</Text>
        <View style={{ width: 26 }} />
      </View>

      {profile.isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {/* Avatar */}
            <View style={s.avatarWrap}>
              <Pressable
                style={s.avatar}
                onPress={pickAvatar}
                disabled={uploadingAvatar}
                accessibilityRole="button"
                accessibilityState={{ disabled: uploadingAvatar }}
                accessibilityLabel={avatarUrl ? "Change profile photo" : "Add profile photo"}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator color="#fff" />
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatarImg} contentFit="cover" accessibilityElementsHidden importantForAccessibility="no" />
                ) : (
                  <Text style={s.avatarInitial}>{(displayName || "?").charAt(0).toUpperCase()}</Text>
                )}
                <View style={s.camBadge}><Ionicons name="camera" size={15} color="#fff" /></View>
              </Pressable>
              <Pressable onPress={pickAvatar} disabled={uploadingAvatar} accessibilityRole="button" accessibilityLabel={avatarUrl ? "Change photo" : "Add profile pic"}>
                <Text style={s.avatarAction}>{avatarUrl ? "Change photo" : "Add profile pic"}</Text>
              </Pressable>
            </View>

            <Field label="Display name">
              <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" accessibilityLabel="Display name" />
            </Field>
            <Field label="Username" hint="Lowercase letters, numbers, underscores">
              <TextInput style={s.input} value={username} autoCapitalize="none" onChangeText={(t) => setUsername(t.toLowerCase())} placeholder="username" accessibilityLabel="Username" />
            </Field>
            <Field label="City">
              <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="e.g. Athens" accessibilityLabel="City" />
            </Field>
            <Field label="Bio">
              <TextInput style={[s.input, s.multiline]} value={bio} onChangeText={setBio} placeholder="A little about you" multiline accessibilityLabel="Bio" />
            </Field>

            {isArtist && (
              <>
                <Text style={s.sectionLabel}>Artist details</Text>
                <Field label="Headline" hint="Shown under your name on your profile">
                  <TextInput style={s.input} value={headline} onChangeText={setHeadline} placeholder="e.g. Fine-line & botanical" accessibilityLabel="Headline" />
                </Field>
                <Field label="Hourly rate" hint="Used for the client price estimate">
                  <TextInput style={s.input} value={hourlyRate} onChangeText={setHourlyRate} keyboardType="number-pad" placeholder="e.g. 120" accessibilityLabel="Hourly rate" />
                </Field>
                <Field label="Minimum charge">
                  <TextInput style={s.input} value={minCharge} onChangeText={setMinCharge} keyboardType="number-pad" placeholder="e.g. 80" accessibilityLabel="Minimum charge" />
                </Field>
                <Field label="Instagram">
                  <TextInput style={s.input} value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="yourhandle" accessibilityLabel="Instagram handle" />
                </Field>
                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Accepting new clients</Text>
                    <Text style={s.hint}>Turn off to pause booking requests</Text>
                  </View>
                  <Switch value={accepting} onValueChange={setAccepting} trackColor={{ true: "#E5484D" }} accessibilityLabel="Accepting new clients" />
                </View>
              </>
            )}

            <Pressable style={[s.saveBtn, saving && s.disabled]} disabled={saving} onPress={save} accessibilityRole="button" accessibilityState={{ disabled: saving }} accessibilityLabel="Save changes">
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
  sectionLabel: { fontSize: 16, fontWeight: "800", color: "#18181B", marginTop: 8, marginBottom: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  label: { fontWeight: "700", fontSize: 13, color: "#52525B", marginBottom: 6 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  hint: { color: "#A1A1AA", fontSize: 12, marginTop: 4 },
  saveBtn: { backgroundColor: "#E5484D", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
});
