import { Ionicons } from "@expo/vector-icons";
import {
  awardDailyActive, redeemReferral, redeemVoucher, rewardKeys, useMyRedemptions, useProfileCompletion,
  useReferralSummary, useRewardHistory, useRewards, useVouchers,
} from "@inkora/data-access";
import {
  PROFILE_COMPLETION_LABELS, type ProfileCompletion, REWARD_REASON_LABEL, type RewardTransaction,
  TIER_COLOR, TIER_LABEL, tierProgress, type Voucher, type VoucherRedemption,
} from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../../components/Toast";
import { supabase } from "../../lib/supabase";

export function RewardsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { account, isLoading } = useRewards(supabase);
  const history = useRewardHistory(supabase);
  const vouchers = useVouchers(supabase);
  const redemptions = useMyRedemptions(supabase);
  const referral = useReferralSummary(supabase);
  const completion = useProfileCompletion(supabase);

  // Daily check-in on open (idempotent per day server-side).
  useEffect(() => {
    void awardDailyActive(supabase).then(() => qc.invalidateQueries({ queryKey: rewardKeys.account }));
  }, [qc]);

  const balance = account?.balance ?? 0;
  const prog = tierProgress(account?.lifetimeEarned ?? 0);

  async function onRedeem(v: Voucher) {
    if (balance < v.costPoints) { toast.show(`You need ${v.costPoints - balance} more points for this`, "error"); return; }
    Alert.alert("Redeem reward?", `Spend ${v.costPoints} points on “${v.title}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Redeem",
        onPress: async () => {
          try {
            const code = await redeemVoucher(supabase, v.id, `${v.id}-${Date.now()}`);
            await Promise.all([
              qc.invalidateQueries({ queryKey: rewardKeys.account }),
              qc.invalidateQueries({ queryKey: rewardKeys.redemptions }),
              qc.invalidateQueries({ queryKey: rewardKeys.history }),
              qc.invalidateQueries({ queryKey: rewardKeys.vouchers }),
            ]);
            toast.show(`Redeemed! Code ${code} — see Your rewards`);
          } catch (e) {
            toast.show((e as Error).message, "error");
          }
        },
      },
    ]);
  }

  if (isLoading) return <SafeAreaView style={s.safe} edges={["top"]}><ActivityIndicator style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topHeader}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={26} color="#18181B" /></Pressable>
        <Text style={s.topTitle}>Rewards</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {/* Balance hero */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>Your points</Text>
          <Text style={s.heroBalance}>{balance.toLocaleString()}</Text>
          <View style={[s.tierBadge, { backgroundColor: TIER_COLOR[prog.current] }]}>
            <Ionicons name="star" size={13} color="#fff" />
            <Text style={s.tierText}>{TIER_LABEL[prog.current]}</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${Math.round(prog.pct * 100)}%` }]} />
          </View>
          <Text style={s.progressNote}>
            {prog.next ? `${prog.toNext.toLocaleString()} pts to ${TIER_LABEL[prog.next]}` : "Top tier reached 🏆"}
          </Text>
        </View>

        {/* Profile completion */}
        <ProfileCompletionCard data={completion.data} onPressItem={() => router.push("/profile/settings")} />

        {/* Vouchers catalog */}
        <Text style={s.sectionTitle}>Redeem points</Text>
        {vouchers.isLoading ? <ActivityIndicator /> : (vouchers.data ?? []).map((v) => (
          <VoucherCard key={v.id} voucher={v} balance={balance} onRedeem={() => onRedeem(v)} />
        ))}

        {/* My redemptions */}
        {(redemptions.data ?? []).length > 0 && (
          <>
            <Text style={s.sectionTitle}>Your rewards</Text>
            {(redemptions.data ?? []).map((r) => <RedemptionRow key={r.id} r={r} />)}
          </>
        )}

        {/* Referrals */}
        <Text style={s.sectionTitle}>Invite friends</Text>
        <ReferralCard
          code={referral.data?.code ?? "…"}
          invited={referral.data?.invitedCount ?? 0}
          earned={referral.data?.pointsEarned ?? 0}
          onRedeemed={() => {
            void qc.invalidateQueries({ queryKey: rewardKeys.account });
            void qc.invalidateQueries({ queryKey: rewardKeys.referral });
          }}
        />

        {/* History */}
        <Text style={s.sectionTitle}>Activity</Text>
        {history.isLoading ? <ActivityIndicator /> : (history.data ?? []).length === 0 ? (
          <Text style={s.muted}>No activity yet.</Text>
        ) : (history.data ?? []).map((t) => <HistoryRow key={t.id} t={t} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileCompletionCard({ data, onPressItem }: { data?: ProfileCompletion; onPressItem: () => void }) {
  if (!data) return null;
  if (data.pct >= 100) {
    return <View style={s.card}><Text style={s.cardTitle}>✅ Profile complete</Text><Text style={s.muted}>You’ve earned all profile bonuses.</Text></View>;
  }
  const items = (["avatar", "bio", "city", "username", "onboarding"] as const);
  return (
    <View style={s.card}>
      <View style={s.cardHeadRow}>
        <Text style={s.cardTitle}>Complete your profile</Text>
        <Text style={s.pct}>{data.pct}%</Text>
      </View>
      <View style={s.progressTrackDark}><View style={[s.progressFillDark, { width: `${data.pct}%` }]} /></View>
      {items.filter((k) => !data[k]).map((k) => (
        <Pressable key={k} style={s.checkRow} onPress={onPressItem}>
          <Ionicons name="ellipse-outline" size={20} color="#A1A1AA" />
          <Text style={s.checkText}>{PROFILE_COMPLETION_LABELS[k]}</Text>
          <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />
        </Pressable>
      ))}
    </View>
  );
}

function VoucherCard({ voucher, balance, onRedeem }: { voucher: Voucher; balance: number; onRedeem: () => void }) {
  const affordable = balance >= voucher.costPoints;
  const soldOut = voucher.stock != null && voucher.stock <= 0;
  return (
    <View style={s.voucher}>
      <View style={{ flex: 1 }}>
        <Text style={s.voucherTitle}>{voucher.title}</Text>
        {voucher.description ? <Text style={s.voucherDesc}>{voucher.description}</Text> : null}
        <Text style={s.voucherCost}>{voucher.costPoints.toLocaleString()} pts</Text>
      </View>
      <Pressable style={[s.redeemBtn, (!affordable || soldOut) && s.redeemBtnOff]} disabled={!affordable || soldOut} onPress={onRedeem}>
        <Text style={[s.redeemText, (!affordable || soldOut) && s.redeemTextOff]}>{soldOut ? "Sold out" : affordable ? "Redeem" : "Locked"}</Text>
      </Pressable>
    </View>
  );
}

function RedemptionRow({ r }: { r: VoucherRedemption }) {
  return (
    <View style={s.redemption}>
      <View style={{ flex: 1 }}>
        <Text style={s.redemptionTitle}>{r.title}</Text>
        <Text style={s.redemptionCode}>{r.code}</Text>
      </View>
      <Text style={[s.redemptionStatus, r.status !== "active" && { color: "#A1A1AA" }]}>{r.status}</Text>
    </View>
  );
}

function ReferralCard({ code, invited, earned, onRedeemed }: { code: string; invited: number; earned: number; onRedeemed: () => void }) {
  const toast = useToast();
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    await Share.share({ message: `Join me on Inkora — use my code ${code} when you sign up and we both earn points! 🖤` });
  }
  async function redeem() {
    if (!entry.trim()) return;
    setBusy(true);
    try {
      await redeemReferral(supabase, entry.trim());
      setEntry("");
      toast.show("Referral applied — points added");
      onRedeemed();
    } catch (e) {
      const msg = (e as Error).message;
      toast.show(/invalid_code/.test(msg) ? "That code doesn’t exist." : /already_referred/.test(msg) ? "You’ve already used a referral." : /self/.test(msg) ? "You can’t use your own code." : msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Your referral code</Text>
      <View style={s.codeRow}>
        <Text style={s.code}>{code}</Text>
        <Pressable style={s.shareBtn} onPress={share}><Ionicons name="share-social" size={16} color="#fff" /><Text style={s.shareText}>Share</Text></Pressable>
      </View>
      <Text style={s.muted}>{invited} joined · {earned.toLocaleString()} pts earned</Text>
      <View style={s.divider} />
      <Text style={s.smallLabel}>Have a friend’s code?</Text>
      <View style={s.codeRow}>
        <TextInput style={s.codeInput} placeholder="ENTER CODE" autoCapitalize="characters" value={entry} onChangeText={setEntry} />
        <Pressable style={[s.applyBtn, busy && s.redeemBtnOff]} disabled={busy} onPress={redeem}><Text style={s.applyText}>Apply</Text></Pressable>
      </View>
    </View>
  );
}

function HistoryRow({ t }: { t: RewardTransaction }) {
  const positive = t.amount > 0;
  const d = new Date(t.createdAt);
  return (
    <View style={s.histRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.histReason}>{REWARD_REASON_LABEL[t.reason]}</Text>
        <Text style={s.histDate}>{d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</Text>
      </View>
      <Text style={[s.histAmount, { color: positive ? "#16A34A" : "#A1A1AA" }]}>{positive ? "+" : ""}{t.amount}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  topTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 16, gap: 10, paddingBottom: 48 },
  muted: { color: "#A1A1AA" },
  hero: { backgroundColor: "#18181B", borderRadius: 24, padding: 24, alignItems: "center", gap: 8 },
  heroLabel: { color: "#A1A1AA", fontWeight: "600" },
  heroBalance: { color: "#fff", fontSize: 48, fontWeight: "900", letterSpacing: -1 },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  tierText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  progressTrack: { width: "100%", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 6 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "#E5484D" },
  progressNote: { color: "#D4D4D8", fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 14 },
  card: { borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, padding: 16, gap: 8 },
  cardHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  pct: { fontSize: 16, fontWeight: "800", color: "#E5484D" },
  progressTrackDark: { height: 8, borderRadius: 4, backgroundColor: "#F4F4F5" },
  progressFillDark: { height: 8, borderRadius: 4, backgroundColor: "#E5484D" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#3F3F46" },
  voucher: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#F4F4F5", borderRadius: 16, padding: 14 },
  voucherTitle: { fontWeight: "800", fontSize: 15 },
  voucherDesc: { color: "#71717A", fontSize: 13, marginTop: 2 },
  voucherCost: { color: "#E5484D", fontWeight: "800", marginTop: 6 },
  redeemBtn: { backgroundColor: "#E5484D", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  redeemBtnOff: { backgroundColor: "#F4F4F5" },
  redeemText: { color: "#fff", fontWeight: "800" },
  redeemTextOff: { color: "#A1A1AA" },
  redemption: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12 },
  redemptionTitle: { fontWeight: "700" },
  redemptionCode: { fontFamily: "monospace", color: "#18181B", marginTop: 2, letterSpacing: 1 },
  redemptionStatus: { fontWeight: "700", color: "#16A34A", textTransform: "capitalize" },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  code: { flex: 1, fontSize: 24, fontWeight: "900", letterSpacing: 3, color: "#18181B" },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#18181B", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  shareText: { color: "#fff", fontWeight: "800" },
  divider: { height: 1, backgroundColor: "#F4F4F5", marginVertical: 6 },
  smallLabel: { fontWeight: "700", color: "#52525B", fontSize: 13 },
  codeInput: { flex: 1, backgroundColor: "#F4F4F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontWeight: "700", letterSpacing: 2 },
  applyBtn: { backgroundColor: "#E5484D", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  applyText: { color: "#fff", fontWeight: "800" },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F5" },
  histReason: { fontWeight: "600", fontSize: 14 },
  histDate: { color: "#A1A1AA", fontSize: 12, marginTop: 2 },
  histAmount: { fontWeight: "800", fontSize: 16 },
});
