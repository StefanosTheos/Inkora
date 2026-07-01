import type { ArtistSearchParams, StyleCard } from "@inkora/domain";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Chip } from "./components";

const DISTANCES = [5, 10, 25, 50];
const RATINGS = [4.0, 4.5];

export function FilterSheet({ visible, onClose, styles, params, onChange, hasLocation }: {
  visible: boolean;
  onClose: () => void;
  styles: StyleCard[];
  params: ArtistSearchParams;
  onChange: (patch: Partial<ArtistSearchParams>) => void;
  hasLocation: boolean;
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
          <Pressable onPress={() => onChange({ styleSlugs: [], radiusKm: null, minRating: 0, acceptingOnly: false })} hitSlop={8}>
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

          <Text style={s.section}>Distance {hasLocation ? "" : "(set your city to enable)"}</Text>
          <View style={s.wrap}>
            <Chip label="Any" active={!params.radiusKm} disabled={!hasLocation} onPress={() => onChange({ radiusKm: null })} />
            {DISTANCES.map((d) => (
              <Chip key={d} label={`${d} km`} active={params.radiusKm === d} disabled={!hasLocation} onPress={() => onChange({ radiusKm: d })} />
            ))}
          </View>

          <Text style={s.section}>Minimum rating</Text>
          <View style={s.wrap}>
            <Chip label="Any" active={!params.minRating} onPress={() => onChange({ minRating: 0 })} />
            {RATINGS.map((r) => (
              <Chip key={r} label={`★ ${r.toFixed(1)}+`} active={params.minRating === r} onPress={() => onChange({ minRating: r })} />
            ))}
          </View>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Accepting new clients only</Text>
            <Switch value={!!params.acceptingOnly} onValueChange={(v) => onChange({ acceptingOnly: v })} />
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
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  switchLabel: { fontSize: 15, fontWeight: "600" },
  doneBtn: { backgroundColor: "#E5484D", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 20 },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
