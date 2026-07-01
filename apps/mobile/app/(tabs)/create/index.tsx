import { View, Text, StyleSheet } from "react-native";

export default function CreateScreen() {
  return (
    <View style={s.c}>
      <Text style={s.t}>Favourites / Create Idea</Text>
      <Text style={s.m}>Saved boards + AI preview placeholder — coming soon.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  t: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  m: { color: "#A1A1AA", marginTop: 6, textAlign: "center" },
});
