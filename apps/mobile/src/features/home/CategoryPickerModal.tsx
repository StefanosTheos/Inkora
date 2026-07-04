import { Ionicons } from "@expo/vector-icons";
import type { StyleCard } from "@inkora/domain";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/** Multi-select category picker. "Search" hands the chosen slugs back so the
 *  caller can apply them as Explore filters. */
export function CategoryPickerModal({ visible, categories, initialSelected, onClose, onApply }: {
  visible: boolean;
  categories: StyleCard[];
  initialSelected: string[];
  onClose: () => void;
  onApply: (slugs: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  useEffect(() => {
    if (visible) setSelected(initialSelected);
  }, [visible, initialSelected]);

  const toggle = (slug: string) =>
    setSelected((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title} accessibilityRole="header">Categories</Text>
          {selected.length > 0 && (
            <Pressable onPress={() => setSelected([])} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear selection">
              <Text style={s.clear}>Clear</Text>
            </Pressable>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {categories.map((c) => {
            const on = selected.includes(c.slug);
            return (
              <Pressable
                key={c.id}
                style={s.row}
                onPress={() => toggle(c.slug)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={c.name}
              >
                <View style={[s.box, on && s.boxOn]}>{on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</View>
                <Text style={s.rowLabel}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable style={s.searchBtn} onPress={() => onApply(selected)} accessibilityRole="button" accessibilityLabel="Search selected categories">
          <Text style={s.searchText}>{selected.length > 0 ? `Search (${selected.length})` : "Search all"}</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#D4D4D8", alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: "#E5484D", borderColor: "#E5484D" },
  rowLabel: { fontSize: 16, fontWeight: "600", color: "#18181B" },
  searchBtn: { backgroundColor: "#E5484D", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 16 },
  searchText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
