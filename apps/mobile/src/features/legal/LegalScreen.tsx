import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type LegalDoc = "help" | "terms" | "privacy";

interface Section {
  heading?: string;
  body: string;
}
interface Doc {
  title: string;
  updated: string;
  intro?: string;
  sections: Section[];
}

const SUPPORT_EMAIL = "support@inkora.app";

const DOCS: Record<LegalDoc, Doc> = {
  help: {
    title: "Help center",
    updated: "Last updated: July 2026",
    intro: "Quick answers to how Inkora works. Still stuck? Email us any time.",
    sections: [
      { heading: "Discovering artists & studios", body: "Browse the Home feed for inspiration, or use the Discover tab to search artists and studios by name, style, distance and rating. Tap any result to open its profile — portfolio, reviews, availability and more." },
      { heading: "Saving artists & designs", body: "Tap the heart on an artist's profile to save them, or open any design and tap Save. Everything you keep appears under You → Saved artists / Saved designs." },
      { heading: "Booking a consultation", body: "Open an artist or studio and tap Request booking. Describe your idea, placement, size, budget and preferred dates. The artist reviews it and can send an offer with a proposed time and a price estimate; you accept to confirm. Inkora only helps you arrange the consultation — no payment is taken through the app." },
      { heading: "Messaging", body: "When you contact an artist or studio, the conversation lives under the Chats tab, where you can share reference photos and voice notes." },
      { heading: "Reviews", body: "After a completed appointment you can leave a review from that booking's detail page. Reviews keep artist ratings honest and help other clients choose." },
      { heading: "Rewards & referrals", body: "Earn points for things like completing your profile, referring friends and daily check-ins, then redeem them for vouchers under Rewards. Share your referral code so friends can join." },
      { heading: "AI preview", body: "“Try this design on you” is an early placeholder to help you picture a design in context. It doesn't generate an image yet." },
      { heading: "Managing your account", body: "Update your name, photo and city under Edit profile. Control push/email notifications and your default search radius under Account settings." },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "Last updated: July 2026",
    intro: "Welcome to Inkora. By using the app you agree to these terms. This is a demo application; the text below is provided for completeness and is not legal advice.",
    sections: [
      { heading: "1. Eligibility", body: "You must be at least 18 years old to arrange a tattoo consultation through Inkora, and you must meet the legal age for tattooing in your area." },
      { heading: "2. What Inkora is", body: "Inkora is a marketplace that helps clients discover tattoo artists and studios and arrange consultations and appointments. Inkora is not a party to any agreement between a client and an artist and does not provide tattooing services." },
      { heading: "3. No payments through the app", body: "Inkora does not process payments. Any deposits or fees are arranged directly between you and the artist or studio, outside the app. Price estimates shown in the app are indicative only." },
      { heading: "4. Your account", body: "You're responsible for the accuracy of your profile and for keeping your account secure. Accounts may hold seeker, artist or studio roles." },
      { heading: "5. Bookings & cancellations", body: "Requests, offers, scheduling, rescheduling and cancellations are arrangements between you and the artist. Please respect each other's time and any studio policies." },
      { heading: "6. Content & conduct", body: "You keep ownership of content you upload but grant Inkora a licence to display it in the app. Don't upload unlawful, infringing or offensive content, and treat other users with respect." },
      { heading: "7. Reviews", body: "Reviews must reflect a genuine experience from a completed appointment. We may remove reviews that break these terms." },
      { heading: "8. Rewards", body: "Reward points have no cash value, can't be transferred, and may be adjusted or expired to prevent abuse." },
      { heading: "9. Disclaimer", body: "Inkora is provided “as is”. We don't guarantee the quality, safety or legality of services arranged through the app." },
      { heading: "10. Changes", body: "We may update these terms from time to time. Continued use of Inkora means you accept the changes." },
      { heading: "11. Contact", body: `Questions about these terms? Email ${SUPPORT_EMAIL}.` },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "Last updated: July 2026",
    intro: "This policy explains what Inkora collects and how it's used. This is a demo application; the text below is provided for completeness and is not legal advice.",
    sections: [
      { heading: "1. Information we collect", body: "Account details (email, name), profile information you provide (username, bio, photo, city), and the things you do in the app — saved artists and designs, bookings, messages, reviews and reward activity." },
      { heading: "2. Location", body: "If you set your city, we geocode it to approximate coordinates to power “nearby” search and distance sorting. Precise coordinates are stored privately and are never shown to other users — only a derived distance is." },
      { heading: "3. How we use your information", body: "To run the core features — discovery, booking, messaging, reviews and rewards — and to send you relevant notifications." },
      { heading: "4. Notifications", body: "With your permission we send push and email notifications about bookings, offers and messages. You can turn these off any time in Account settings." },
      { heading: "5. Sharing", body: "Your public profile (name, photo, city) is visible to other users. We do not sell your personal data." },
      { heading: "6. Data retention", body: "We keep your data while your account is active. You can request deletion from Account settings → Delete account." },
      { heading: "7. Security", body: "Access is protected by row-level security and encrypted connections. No system is perfectly secure, so please use a strong, unique password." },
      { heading: "8. Children", body: "Inkora is not intended for anyone under 18." },
      { heading: "9. Your rights", body: "You can access, correct or delete your information from within the app or by contacting us." },
      { heading: "10. Contact", body: `Privacy questions? Email ${SUPPORT_EMAIL}.` },
    ],
  },
};

export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const router = useRouter();
  const content = DOCS[doc] ?? DOCS.help;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#18181B" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{content.title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.updated}>{content.updated}</Text>
        {content.intro ? <Text style={s.intro}>{content.intro}</Text> : null}
        {content.sections.map((sec) => (
          <View key={sec.heading ?? sec.body.slice(0, 24)} style={s.section}>
            {sec.heading ? <Text style={s.sectionHeading} accessibilityRole="header">{sec.heading}</Text> : null}
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}

        <Pressable
          style={s.contactBtn}
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Inkora%20support`)}
          accessibilityRole="button"
          accessibilityLabel={`Email support at ${SUPPORT_EMAIL}`}
        >
          <Ionicons name="mail-outline" size={18} color="#fff" />
          <Text style={s.contactText}>Contact support</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  headerTitle: { fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },
  body: { padding: 20, paddingBottom: 40 },
  updated: { color: "#A1A1AA", fontSize: 12, marginBottom: 12 },
  intro: { color: "#3F3F46", lineHeight: 21, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionHeading: { fontSize: 16, fontWeight: "800", color: "#18181B", marginBottom: 6 },
  sectionBody: { color: "#3F3F46", lineHeight: 21, fontSize: 14 },
  contactBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#18181B", borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  contactText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
