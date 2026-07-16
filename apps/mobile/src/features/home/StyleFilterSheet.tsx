import type { StyleCard } from "@inkora/domain";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip } from "../discovery/components";

/** Styles-only filter sheet for the Explore feed (mirrors Discover's FilterSheet
 *  look, minus the artist-only distance/rating sections). Toggles apply live. */
export function StyleFilterSheet({ visible, onClose, styles, selected, onToggle, onClear }: {
  visible: boolean;
  onClose: () => void;
  styles: StyleCard[];
  selected: string[];
  onToggle: (slug: string) => void;
  onClear: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title}>Filter by style</Text>
          {selected.length > 0 ? (
            <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear style filters">
              <Text style={s.clear}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.wrap}>
            {styles.map((st) => (
              <Chip key={st.id} label={st.name} active={selected.includes(st.slug)} onPress={() => onToggle(st.slug)} />
            ))}
          </View>
        </ScrollView>

        <Pressable style={s.doneBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Show designs">
          <Text style={s.doneText}>{selected.length > 0 ? `Show designs (${selected.length})` : "Show designs"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "80%", backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D4D4D8", marginBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, minHeight: 24 },
  title: { fontSize: 20, fontWeight: "800" },
  clear: { color: "#E5484D", fontWeight: "600" },
  wrap: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  doneBtn: { backgroundColor: "#E5484D", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 20 },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
