"use client";
import {
  awardDailyActive, redeemReferral, redeemVoucher, rewardKeys, useMyRedemptions, useProfileCompletion,
  useReferralSummary, useRewardHistory, useRewards, useVouchers,
} from "@inkora/data-access";
import {
  PROFILE_COMPLETION_LABELS, REWARD_REASON_LABEL, TIER_COLOR, TIER_LABEL, tierProgress, type Voucher,
} from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getSupabaseBrowser } from "../../lib/supabase-browser";

export function RewardsView() {
  const client = getSupabaseBrowser();
  const qc = useQueryClient();
  const { account } = useRewards(client);
  const history = useRewardHistory(client);
  const vouchers = useVouchers(client);
  const redemptions = useMyRedemptions(client);
  const referral = useReferralSummary(client);
  const completion = useProfileCompletion(client);
  const [entry, setEntry] = useState("");

  useEffect(() => { void awardDailyActive(client).then(() => qc.invalidateQueries({ queryKey: rewardKeys.account })); }, [client, qc]);

  const balance = account?.balance ?? 0;
  const prog = tierProgress(account?.lifetimeEarned ?? 0);

  async function redeem(v: Voucher) {
    if (balance < v.costPoints) { alert("Not enough points."); return; }
    if (!confirm(`Spend ${v.costPoints} points on “${v.title}”?`)) return;
    try {
      const code = await redeemVoucher(client, v.id, `${v.id}-${Date.now()}`);
      await Promise.all([rewardKeys.account, rewardKeys.redemptions, rewardKeys.history, rewardKeys.vouchers].map((k) => qc.invalidateQueries({ queryKey: k })));
      alert(`Redeemed! Code: ${code}`);
    } catch (e) { alert((e as Error).message); }
  }
  async function applyCode() {
    if (!entry.trim()) return;
    try {
      await redeemReferral(client, entry.trim());
      setEntry("");
      await qc.invalidateQueries({ queryKey: rewardKeys.account });
      await qc.invalidateQueries({ queryKey: rewardKeys.referral });
      alert("Referral applied!");
    } catch (e) { alert((e as Error).message); }
  }

  const items = ["avatar", "bio", "city", "username", "onboarding"] as const;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="rounded-3xl bg-zinc-900 p-6 text-center text-white">
        <p className="text-zinc-400">Your points</p>
        <p className="text-5xl font-black">{balance.toLocaleString()}</p>
        <span className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: TIER_COLOR[prog.current] }}>{TIER_LABEL[prog.current]}</span>
        <div className="mx-auto mt-3 h-1.5 max-w-sm overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-[#E5484D]" style={{ width: `${Math.round(prog.pct * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-zinc-300">{prog.next ? `${prog.toNext.toLocaleString()} pts to ${TIER_LABEL[prog.next]}` : "Top tier 🏆"}</p>
      </div>

      {completion.data && completion.data.pct < 100 && (
        <section className="mt-6 rounded-2xl border p-4">
          <div className="flex items-center justify-between"><h2 className="font-bold">Complete your profile</h2><span className="font-bold text-[#E5484D]">{completion.data.pct}%</span></div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600">
            {items.filter((k) => !completion.data![k]).map((k) => <li key={k}>○ {PROFILE_COMPLETION_LABELS[k]}</li>)}
          </ul>
        </section>
      )}

      <h2 className="mt-6 mb-2 text-lg font-bold">Redeem points</h2>
      <div className="space-y-2">
        {(vouchers.data ?? []).map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-2xl border p-4">
            <div>
              <p className="font-bold">{v.title}</p>
              {v.description && <p className="text-sm text-zinc-500">{v.description}</p>}
              <p className="font-bold text-[#E5484D]">{v.costPoints.toLocaleString()} pts</p>
            </div>
            <button disabled={balance < v.costPoints} onClick={() => redeem(v)} className="rounded-lg bg-[#E5484D] px-4 py-2 font-semibold text-white disabled:bg-zinc-100 disabled:text-zinc-400">
              {balance < v.costPoints ? "Locked" : "Redeem"}
            </button>
          </div>
        ))}
      </div>

      {(redemptions.data ?? []).length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-lg font-bold">Your rewards</h2>
          <ul className="space-y-2">
            {(redemptions.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                <span className="font-semibold">{r.title}</span>
                <code className="tracking-widest">{r.code}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="font-bold">Invite friends</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-2xl font-black tracking-[0.2em]">{referral.data?.code ?? "…"}</span>
          <button onClick={() => { void navigator.clipboard?.writeText(referral.data?.code ?? ""); }} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white">Copy</button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{referral.data?.invitedCount ?? 0} joined · {(referral.data?.pointsEarned ?? 0).toLocaleString()} pts earned</p>
        <div className="mt-3 flex gap-2">
          <input value={entry} onChange={(e) => setEntry(e.target.value.toUpperCase())} placeholder="ENTER A FRIEND'S CODE" className="flex-1 rounded-lg border px-3 py-2 tracking-widest" />
          <button onClick={applyCode} className="rounded-lg bg-[#E5484D] px-4 py-2 font-semibold text-white">Apply</button>
        </div>
      </section>

      <h2 className="mt-6 mb-2 text-lg font-bold">Activity</h2>
      <ul className="divide-y">
        {(history.data ?? []).map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2">
            <span>{REWARD_REASON_LABEL[t.reason]}</span>
            <span className={t.amount > 0 ? "font-bold text-green-600" : "font-bold text-zinc-400"}>{t.amount > 0 ? "+" : ""}{t.amount}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
