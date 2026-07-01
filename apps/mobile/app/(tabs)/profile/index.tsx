import { useAuth } from "@inkora/data-access";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  const { ctx, signOut } = useAuth();
  return (
    <View style={s.c}>
      <Text style={s.t}>Profile</Text>
      <Text style={s.m}>Roles: {ctx.roles.join(", ") || "—"}</Text>
      <Link href="/bookings" style={s.link}>My bookings</Link>
      <Link href="/notifications" style={s.link}>Notifications</Link>
      {ctx.roles.includes("artist") && <Link href="/artist-dashboard" style={s.link}>Artist dashboard</Link>}
      {ctx.roles.includes("artist") && <Link href="/artist-dashboard/requests" style={s.link}>Booking requests</Link>}
      <Link href="/rewards" style={s.link}>Rewards</Link>
      <Link href="/profile/settings" style={s.link}>Settings</Link>
      <Pressable style={s.signout} onPress={signOut}>
        <Text style={s.signoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  t: { fontSize: 22, fontWeight: "800" },
  m: { color: "#A1A1AA" },
  link: { color: "#E5484D", fontWeight: "600", marginTop: 8 },
  signout: { marginTop: 24, borderWidth: 1, borderColor: "#E4E4E7", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  signoutText: { fontWeight: "700" },
});
