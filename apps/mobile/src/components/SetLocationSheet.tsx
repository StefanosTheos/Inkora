import { Ionicons } from "@expo/vector-icons";
import { updateProfileLocation } from "@inkora/data-access";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "../lib/supabase";
import { useToast } from "./Toast";

/**
 * Inline "set your city" sheet. Geocodes the city (+ optional country) and saves
 * it to the profile, then invalidates location-dependent queries so distance
 * sorts / the nearby rail light up immediately. Shared by Discover and Home so
 * a location-gated control is never a dead-end.
 */
export function SetLocationSheet({ visible, onClose, onSaved }: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const c = city.trim();
    if (!c) { toast.show("Enter your city", "error"); return; }
    setBusy(true);
    const res = await updateProfileLocation(supabase, c, country.trim() || undefined);
    setBusy(false);
    if (!res.ok) { toast.show(res.error.message, "error"); return; }
    if (!res.value) {
      // City saved but geocoding missed — distance still won't work without coords.
      toast.show("Couldn't locate that city — try adding the country.", "error");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-location"] });
    toast.show("Location set");
    setCity("");
    setCountry("");
    onSaved?.();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.titleRow}>
          <Ionicons name="location-outline" size={22} color="#E5484D" />
          <Text style={s.title}>Set your city</Text>
        </View>
        <Text style={s.sub}>So we can sort by distance and show artists & studios near you.</Text>

        <TextInput style={s.input} placeholder="City" value={city} onChangeText={setCity} autoCapitalize="words" autoFocus accessibilityLabel="City" />
        <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Country (improves accuracy)" value={country} onChangeText={setCountry} autoCapitalize="words" accessibilityLabel="Country" />

        <Pressable style={[s.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy} accessibilityRole="button" accessibilityLabel="Save location">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D4D4D8", marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "800" },
  sub: { color: "#71717A", fontSize: 13, marginTop: 6, marginBottom: 14 },
  input: { backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { backgroundColor: "#E5484D", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 18 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
