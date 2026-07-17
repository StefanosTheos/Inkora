import { Ionicons } from "@expo/vector-icons";
import type { ArtistSearchParams, StyleCard } from "@inkora/domain";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip } from "./components";

const DISTANCES = [5, 10, 25, 50];
const RATINGS = [4.0, 4.5];

export function FilterSheet({ visible, onClose, styles, params, onChange, hasLocation, onSetLocation }: {
  visible: boolean;
  onClose: () => void;
  styles: StyleCard[];
  params: ArtistSearchParams;
  onChange: (patch: Partial<ArtistSearchParams>) => void;
  hasLocation: boolean;
  onSetLocation: () => void;
}) {
  const toggleStyle = (slug: string) => {
    const has = params.styleSlugs.includes(slug);
    onChange({ styleSlugs: has ? params.styleSlugs.filter((x) => x !== slug) : [...params.styleSlugs, slug] });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title}>Filters</Text>
          <Pressable onPress={() => onChange({ styleSlugs: [], radiusKm: null, minRating: 0 })} hitSlop={8}>
            <Text style={s.clear}>Clear all</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={s.section}>Styles</Text>
          <View style={s.wrap}>
            {styles.map((st) => (
              <Chip key={st.id} label={st.name} active={params.styleSlugs.includes(st.slug)} onPress={() => toggleStyle(st.slug)} />
            ))}
          </View>

          <Text style={s.section}>Distance</Text>
          {hasLocation ? (
            <View style={s.wrap}>
              <Chip label="Any" active={!params.radiusKm} onPress={() => onChange({ radiusKm: null })} />
              {DISTANCES.map((d) => (
                <Chip key={d} label={`${d} km`} active={params.radiusKm === d} onPress={() => onChange({ radiusKm: d })} />
              ))}
            </View>
          ) : (
            <Pressable style={s.setCity} onPress={onSetLocation} accessibilityRole="button" accessibilityLabel="Set your city to filter by distance">
              <Ionicons name="location-outline" size={18} color="#E5484D" />
              <Text style={s.setCityText}>Set your city to filter by distance</Text>
              <Ionicons name="chevron-forward" size={16} color="#C4C4C8" />
            </Pressable>
          )}

          <Text style={s.section}>Minimum rating</Text>
          <View style={s.wrap}>
            <Chip label="Any" active={!params.minRating} onPress={() => onChange({ minRating: 0 })} />
            {RATINGS.map((r) => (
              <Chip key={r} label={`★ ${r.toFixed(1)}+`} active={params.minRating === r} onPress={() => onChange({ minRating: r })} />
            ))}
          </View>
        </ScrollView>

        <Pressable style={s.doneBtn} onPress={onClose}>
          <Text style={s.doneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "80%", backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D4D4D8", marginBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "800" },
  clear: { color: "#E5484D", fontWeight: "600" },
  section: { fontSize: 14, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  setCity: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: "#F1D6D7", backgroundColor: "#FFF5F5" },
  setCityText: { flex: 1, color: "#18181B", fontWeight: "700", fontSize: 14 },
  doneBtn: { backgroundColor: "#E5484D", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 20 },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
