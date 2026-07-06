import type { RewardReason, RewardTier, RewardTxnType } from "../enums";
import type { ProfileId } from "../ids";

export interface RewardAccount {
  profileId: ProfileId;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: RewardTier;
}

export interface RewardTransaction {
  id: string;
  profileId: ProfileId;
  type: RewardTxnType;
  reason: RewardReason;
  amount: number;        // signed
  balanceAfter: number;
  createdAt: string;
}

/** Reference attached to a reward transaction (e.g. the appointment that earned it). */
export interface RewardRef {
  type: string;
  id: string;
}

// ---------------------------------------------------------------- vouchers
export interface Voucher {
  id: string;
  title: string;
  description: string | null;
  kind: string; // perk | discount | merch
  valueText: string | null;
  costPoints: number;
  stock: number | null; // null = unlimited
}

export interface VoucherRedemption {
  id: string;
  voucherId: string;
  title: string; // resolved voucher title
  code: string;
  costPoints: number;
  status: string; // active | used | expired
  createdAt: string;
  expiresAt: string | null;
}

// ---------------------------------------------------------------- referrals
export interface ReferralSummary {
  code: string;
  invitedCount: number;
  pointsEarned: number;
}

// ---------------------------------------------------------------- profile completion
export interface ProfileCompletion {
  avatar: boolean;
  bio: boolean;
  city: boolean;
  username: boolean;
  onboarding: boolean;
  completed: number;
  total: number;
  pct: number;
}

export const PROFILE_COMPLETION_LABELS: Record<keyof Pick<ProfileCompletion, "avatar" | "bio" | "city" | "username" | "onboarding">, string> = {
  avatar: "Add a profile photo",
  bio: "Write a short bio",
  city: "Set your city",
  username: "Pick a username",
  onboarding: "Finish style onboarding",
};

// ---------------------------------------------------------------- tiers
export const TIER_ORDER: RewardTier[] = ["bronze", "silver", "gold", "platinum"];
export const TIER_THRESHOLD: Record<RewardTier, number> = { bronze: 0, silver: 500, gold: 2000, platinum: 5000 };
export const TIER_LABEL: Record<RewardTier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };
export const TIER_COLOR: Record<RewardTier, string> = { bronze: "#B45309", silver: "#71717A", gold: "#CA8A04", platinum: "#7C3AED" };

/** Progress toward the next tier from lifetime-earned points. */
export function tierProgress(lifetimeEarned: number): {
  current: RewardTier; next: RewardTier | null; toNext: number; pct: number;
} {
  let current: RewardTier = "bronze";
  for (const t of TIER_ORDER) if (lifetimeEarned >= TIER_THRESHOLD[t]) current = t;
  const idx = TIER_ORDER.indexOf(current);
  const next = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1]! : null;
  if (!next) return { current, next: null, toNext: 0, pct: 1 };
  const base = TIER_THRESHOLD[current];
  const span = TIER_THRESHOLD[next] - base;
  const into = lifetimeEarned - base;
  return { current, next, toNext: Math.max(0, TIER_THRESHOLD[next] - lifetimeEarned), pct: Math.min(1, into / span) };
}

/** Human labels for ledger reasons. */
export const REWARD_REASON_LABEL: Record<RewardReason, string> = {
  signup: "Welcome bonus",
  daily_active: "Daily check-in",
  save: "Saved inspiration",
  message_sent: "Message sent",
  booking_completed: "Tattoo completed",
  review_left: "Left a review",
  referral: "Referral",
  redemption: "Voucher redeemed",
  manual_adjust: "Adjustment",
  journey_milestone: "Healing photo added",
  journey_completed: "Journey completed",
};
