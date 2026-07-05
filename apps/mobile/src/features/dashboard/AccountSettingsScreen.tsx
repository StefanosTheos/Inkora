import { Ionicons } from "@expo/vector-icons";
import { dashboardKeys, setNotificationPrefs, updateMyProfile, useAccountSettings, useAuth } from "@inkora/data-access";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { getPushPermission } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";

export function AccountSettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { ctx, signOut } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isArtist = ctx.roles.includes("artist");
  const settings = useAccountSettings(supabase);

  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("email");
  const [radius, setRadius] = useState(25);
  const [push, setPush] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [osBlocked, setOsBlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "—");
      const p = (data.user?.app_metadata as { provider?: string } | undefined)?.provider;
      setProvider(p ?? "email");
    });
    void getPushPermission().then((p) => setOsBlocked(!p.granted));
  }, []);
  useEffect(() => {
    if (settings.data && !hydrated) {
      setRadius(settings.data.searchRadiusKm);
      setPush(settings.data.pushEnabled);
      setEmailNotif(settings.data.emailEnabled);
      setHydrated(true);
    }
  }, [settings.data, hydrated]);

  async function changeRadius(next: number) {
    const clamped = Math.min(200, Math.max(5, next));
    setRadius(clamped);
    try {
      await updateMyProfile(supabase, { searchRadiusKm: clamped });
      await qc.invalidateQueries({ queryKey: dashboardKeys.accountSettings });
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }
  async function toggle(kind: "push" | "email", value: boolean) {
    if (kind === "push") setPush(value); else setEmailNotif(value);
    try {
      await setNotificationPrefs(supabase, { [kind]: value });
      await qc.invalidateQueries({ queryKey: dashboardKeys.accountSettings });
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }
  function confirmSignOut() {
    void confirm({
      title: "Sign out?",
      message: "You'll need to sign in again to book, chat and see your rewards.",
      confirmLabel: "Sign out",
      destructive: true,
    }).then((ok) => { if (ok) void signOut(); });
  }
  function confirmDelete() {
    void confirm({
      title: "Delete account?",
      message: "This permanently removes your profile, bookings and saved items. This can’t be undone. For the demo, contact support to complete deletion.",
      confirmLabel: "Delete",
      destructive: true,
    }).then((ok) => { if (ok) void Linking.openURL("mailto:support@inkora.app?subject=Delete%20my%20account"); });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">Account settings</Text>
        <View style={{ width: 26 }} />
      </View>

      {settings.isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          {/* Account */}
          <Text style={s.section} accessibilityRole="header">Account</Text>
          <View style={s.card}>
            <Row label="Email" value={email} />
            <Row label="Signed in via" value={provider.charAt(0).toUpperCase() + provider.slice(1)} />
            <Row label="Role" value={isArtist ? "Artist" : "Seeker"} last />
          </View>

          {/* Preferences — seeker-only (search radius drives discovery) */}
          {!isArtist && (
            <>
              <Text style={s.section} accessibilityRole="header">Preferences</Text>
              <View style={s.card}>
                <View style={[s.rowFlex, s.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>Search radius</Text>
                    <Text style={s.rowHint}>How far to look for artists & studios</Text>
                  </View>
                  <View style={s.stepper}>
                    <Pressable style={s.stepBtn} onPress={() => changeRadius(radius - 5)} accessibilityRole="button" accessibilityLabel="Decrease search radius"><Ionicons name="remove" size={18} color="#18181B" /></Pressable>
                    <Text style={s.stepValue} accessibilityLabel={`Search radius ${radius} kilometres`}>{radius} km</Text>
                    <Pressable style={s.stepBtn} onPress={() => changeRadius(radius + 5)} accessibilityRole="button" accessibilityLabel="Increase search radius"><Ionicons name="add" size={18} color="#18181B" /></Pressable>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Notifications */}
          <Text style={s.section} accessibilityRole="header">Notifications</Text>
          <View style={s.card}>
            {osBlocked && (
              <Pressable style={[s.rowFlex, s.rowBorder]} onPress={() => void Linking.openSettings()} accessibilityRole="button" accessibilityLabel="Notifications are off. Tap to enable in system settings">
                <Ionicons name="notifications-off-outline" size={20} color="#DC2626" />
                <Text style={[s.linkLabel, { color: "#DC2626" }]}>Notifications are off — tap to enable in Settings</Text>
              </Pressable>
            )}
            <ToggleRow label="Push notifications" hint="Bookings, offers and messages" value={push} onValueChange={(v) => toggle("push", v)} />
            <ToggleRow label="Email notifications" hint="Summaries and important updates" value={emailNotif} onValueChange={(v) => toggle("email", v)} last />
          </View>

          {/* Support & legal */}
          <Text style={s.section} accessibilityRole="header">Support & legal</Text>
          <View style={s.card}>
            <LinkRow icon="help-circle-outline" label="Help center" onPress={() => router.push("/legal/help")} />
            <LinkRow icon="document-text-outline" label="Terms of Service" onPress={() => router.push("/legal/terms")} />
            <LinkRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push("/legal/privacy")} last />
          </View>

          {/* Danger zone */}
          <Text style={[s.section, { color: "#DC2626" }]} accessibilityRole="header">Danger zone</Text>
          <View style={s.card}>
            <LinkRow icon="log-out-outline" label="Sign out" onPress={confirmSignOut} />
            <LinkRow icon="trash-outline" label="Delete account" danger onPress={confirmDelete} last />
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.rowFlex, !last && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}
function ToggleRow({ label, hint, value, onValueChange, last }: { label: string; hint: string; value: boolean; onValueChange: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={[s.rowFlex, !last && s.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowHint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: "#E5484D" }} accessibilityLabel={label} />
    </View>
  );
}
function LinkRow({ icon, label, onPress, danger, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  return (
    <Pressable style={[s.rowFlex, !last && s.rowBorder]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={danger ? "#DC2626" : "#52525B"} />
      <Text style={[s.linkLabel, danger && { color: "#DC2626" }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 16 },
  section: { fontSize: 12, fontWeight: "800", color: "#71717A", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, overflow: "hidden" },
  rowFlex: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  rowLabel: { fontWeight: "600", fontSize: 15, color: "#18181B" },
  rowValue: { flex: 1, textAlign: "right", color: "#71717A", fontSize: 14 },
  rowHint: { color: "#A1A1AA", fontSize: 12, marginTop: 2 },
  linkLabel: { flex: 1, fontWeight: "600", fontSize: 15, color: "#18181B" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  stepValue: { fontWeight: "800", fontSize: 14, minWidth: 46, textAlign: "center" },
});
