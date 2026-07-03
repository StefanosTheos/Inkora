import type {
  ProfileCompletion, ProfileId, ReferralSummary, RewardAccount, RewardReason, RewardTier,
  RewardTransaction, RewardTxnType, Voucher, VoucherRedemption,
} from "@inkora/domain";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

// ------------------------------------------------------------------ account
export async function getRewardAccount(client: InkoraClient): Promise<RewardAccount> {
  const { data, error } = await client
    .from("reward_points")
    .select("profile_id, balance, lifetime_earned, lifetime_redeemed, tier")
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return { profileId: "" as ProfileId, balance: 0, lifetimeEarned: 0, lifetimeRedeemed: 0, tier: "bronze" };
  return {
    profileId: data.profile_id as ProfileId,
    balance: data.balance,
    lifetimeEarned: data.lifetime_earned,
    lifetimeRedeemed: data.lifetime_redeemed,
    tier: data.tier as RewardTier,
  };
}

export async function getRewardHistory(client: InkoraClient, limit = 50): Promise<RewardTransaction[]> {
  const { data, error } = await client
    .from("reward_transactions")
    .select("id, profile_id, type, reason, amount, balance_after, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    profileId: r.profile_id as ProfileId,
    type: r.type as RewardTxnType,
    reason: r.reason as RewardReason,
    amount: r.amount,
    balanceAfter: r.balance_after,
    createdAt: r.created_at,
  }));
}

// ------------------------------------------------------------------ vouchers
export async function listVouchers(client: InkoraClient): Promise<Voucher[]> {
  const { data, error } = await client
    .from("vouchers")
    .select("id, title, description, kind, value_text, cost_points, stock")
    .order("sort_order", { ascending: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((v) => ({
    id: v.id, title: v.title, description: v.description, kind: v.kind,
    valueText: v.value_text, costPoints: v.cost_points, stock: v.stock,
  }));
}

interface RedemptionRow {
  id: string; voucher_id: string; code: string; cost_points: number; status: string;
  created_at: string; expires_at: string | null; vouchers: { title: string } | null;
}
export async function listMyRedemptions(client: InkoraClient): Promise<VoucherRedemption[]> {
  const { data, error } = await client
    .from("voucher_redemptions")
    .select("id, voucher_id, code, cost_points, status, created_at, expires_at, vouchers(title)")
    .order("created_at", { ascending: false })
    .returns<RedemptionRow[]>();
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => ({
    id: r.id, voucherId: r.voucher_id, title: r.vouchers?.title ?? "Voucher",
    code: r.code, costPoints: r.cost_points, status: r.status,
    createdAt: r.created_at, expiresAt: r.expires_at,
  }));
}

/**
 * Redeem a voucher (spends points). Returns the generated code.
 * Pass a stable `idempotencyKey` so a retry/double-tap can't double-spend.
 */
export async function redeemVoucher(client: InkoraClient, voucherId: string, idempotencyKey?: string): Promise<string> {
  const { data, error } = await client.rpc("redeem_voucher", { p_voucher: voucherId, p_idempotency_key: idempotencyKey });
  if (error) throw toAppError(error);
  return (data as { code: string } | null)?.code ?? "";
}

// ------------------------------------------------------------------ referrals
export async function getReferralSummary(client: InkoraClient): Promise<ReferralSummary> {
  const { data: userRes } = await client.auth.getUser();
  const me = userRes.user?.id;
  const { data: code, error: codeErr } = await client.rpc("get_referral_code");
  if (codeErr) throw toAppError(codeErr);
  const { data: refs } = await client.from("referrals").select("id").eq("referrer_id", me ?? "");
  const { data: txns } = await client.from("reward_transactions").select("amount").eq("reason", "referral");
  const pointsEarned = (txns ?? []).reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
  return { code: (code as string) ?? "", invitedCount: refs?.length ?? 0, pointsEarned };
}

export async function redeemReferral(client: InkoraClient, code: string): Promise<void> {
  const { error } = await client.rpc("redeem_referral", { p_code: code.trim() });
  if (error) throw toAppError(error);
}

// ------------------------------------------------------------------ engagement
export async function awardDailyActive(client: InkoraClient): Promise<void> {
  const { error } = await client.rpc("award_daily_active");
  if (error) throw toAppError(error);
}

export async function claimProfileCompletion(client: InkoraClient): Promise<ProfileCompletion> {
  const { data, error } = await client.rpc("claim_profile_completion");
  if (error) throw toAppError(error);
  return data as unknown as ProfileCompletion;
}

// ------------------------------------------------------------------ keys + hooks
export const rewardKeys = {
  account: ["reward-account"] as const,
  history: ["reward-history"] as const,
  vouchers: ["vouchers"] as const,
  redemptions: ["voucher-redemptions"] as const,
  referral: ["referral-summary"] as const,
  completion: ["profile-completion"] as const,
};

let rewardChannelSeq = 0;

/** Live rewards account: balance/tier + realtime refresh on ledger changes. */
export function useRewards(client: InkoraClient) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: rewardKeys.account, queryFn: () => getRewardAccount(client) });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [topic] = useState(() => `rewards-${++rewardChannelSeq}`);

  useEffect(() => {
    const channel = client
      .channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_points" }, () => {
        void qc.invalidateQueries({ queryKey: rewardKeys.account });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reward_transactions" }, () => {
        void qc.invalidateQueries({ queryKey: rewardKeys.account });
        void qc.invalidateQueries({ queryKey: rewardKeys.history });
      })
      .subscribe();
    channelRef.current = channel;
    return () => { void client.removeChannel(channel); };
  }, [client, qc, topic]);

  return { account: q.data, isLoading: q.isLoading };
}

export function useRewardHistory(client: InkoraClient) {
  return useQuery({ queryKey: rewardKeys.history, queryFn: () => getRewardHistory(client) });
}
export function useVouchers(client: InkoraClient) {
  return useQuery({ queryKey: rewardKeys.vouchers, queryFn: () => listVouchers(client) });
}
export function useMyRedemptions(client: InkoraClient) {
  return useQuery({ queryKey: rewardKeys.redemptions, queryFn: () => listMyRedemptions(client) });
}
export function useReferralSummary(client: InkoraClient) {
  return useQuery({ queryKey: rewardKeys.referral, queryFn: () => getReferralSummary(client) });
}
/** Claims (idempotently) + returns profile-completion state; safe to run on mount. */
export function useProfileCompletion(client: InkoraClient) {
  return useQuery({ queryKey: rewardKeys.completion, queryFn: () => claimProfileCompletion(client) });
}
