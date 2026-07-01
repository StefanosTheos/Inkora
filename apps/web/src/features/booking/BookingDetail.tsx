"use client";
import {
  bookingKeys, cancelAppointment, cancelRequest, completeAppointment, createOffer, declineRequest,
  respondToOffer, useAppointment, useAuth, useBookingRequest, withdrawOffer,
} from "@inkora/data-access";
import {
  APPOINTMENT_STATUS_LABEL, type AppointmentRequestView, type AppointmentView, type OfferView, REQUEST_STATUS_LABEL,
} from "@inkora/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "../../lib/supabase-browser";
import { fmtDateTime, money } from "./format";

export function BookingDetail({ id }: { id: string }) {
  const client = getSupabaseBrowser();
  const { ctx } = useAuth();
  const meId = ctx.userId ?? "";
  const apptQ = useAppointment(client, id);
  const reqQ = useBookingRequest(client, id);

  if (apptQ.data) return <AppointmentView_ appt={apptQ.data} meId={meId} />;
  if (reqQ.data) return <RequestView req={reqQ.data} meId={meId} />;
  if (apptQ.isLoading || reqQ.isLoading) return <main className="p-8 text-zinc-500">Loading…</main>;
  return <main className="p-8 text-zinc-500">This booking no longer exists.</main>;
}

function useRun(id: string) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: bookingKeys.request(id) });
      await qc.invalidateQueries({ queryKey: bookingKeys.appointment(id) });
      await qc.invalidateQueries({ queryKey: bookingKeys.appointments });
      await qc.invalidateQueries({ queryKey: bookingKeys.clientRequests });
      await qc.invalidateQueries({ queryKey: bookingKeys.artistRequests });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function AppointmentView_({ appt, meId }: { appt: AppointmentView; meId: string }) {
  const client = getSupabaseBrowser();
  const isArtist = appt.artistId === meId;
  const { busy, run } = useRun(appt.id);
  const active = appt.status === "scheduled" || appt.status === "rescheduled";
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">{appt.counterparty.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">{isArtist ? "Client" : "Artist"} · {APPOINTMENT_STATUS_LABEL[appt.status]}</p>
      <div className="mt-4 space-y-1 rounded-xl bg-zinc-50 p-4">
        <p>🗓 {fmtDateTime(appt.scheduledStart)} – {fmtDateTime(appt.scheduledEnd)}</p>
        {appt.priceAmount != null && <p>🏷 {money(appt.priceAmount)}</p>}
        {appt.depositAmount != null && <p>💳 {money(appt.depositAmount)} deposit {appt.depositPaid ? "· paid" : "· due"}</p>}
      </div>
      {active && (
        <div className="mt-4 flex flex-wrap gap-2">
          {isArtist && <button disabled={busy} className="rounded-lg border px-4 py-2 font-semibold" onClick={() => run(() => completeAppointment(client, appt.id))}>Mark completed</button>}
          <button disabled={busy} className="rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-600" onClick={() => run(() => cancelAppointment(client, appt.id))}>Cancel</button>
        </div>
      )}
    </main>
  );
}

function RequestView({ req, meId }: { req: AppointmentRequestView; meId: string }) {
  const client = getSupabaseBrowser();
  const router = useRouter();
  const isArtist = req.artistId === meId;
  const { busy, run } = useRun(req.id);
  const openForArtist = isArtist && ["pending", "reviewing", "offered"].includes(req.status);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <p className="text-sm text-zinc-500">{req.counterparty.name} · {REQUEST_STATUS_LABEL[req.status]}</p>
      <h1 className="mt-1 text-2xl font-bold">{req.title}</h1>
      {req.description && <p className="mt-2 text-zinc-700">{req.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {req.placement && <Tag>{req.placement}</Tag>}
        {req.approxSize && <Tag>{req.approxSize}</Tag>}
        {req.isColor != null && <Tag>{req.isColor ? "Color" : "Black & grey"}</Tag>}
        {(req.budgetMin || req.budgetMax) && <Tag>Budget {money(req.budgetMin)}–{money(req.budgetMax)}</Tag>}
      </div>

      {req.offers.length > 0 && <h2 className="mt-6 mb-2 font-bold">Offers</h2>}
      <div className="space-y-3">
        {req.offers.map((o) => (
          <OfferCard
            key={o.id} offer={o} isArtist={isArtist} busy={busy}
            onAccept={() => run(async () => { const a = await respondToOffer(client, o.id, true); if (a) router.replace(`/booking/${a}`); })}
            onDecline={() => run(async () => { await respondToOffer(client, o.id, false); })}
            onWithdraw={() => run(() => withdrawOffer(client, o.id))}
          />
        ))}
      </div>

      {openForArtist && <OfferComposer requestId={req.id} />}

      {isArtist && (req.status === "pending" || req.status === "reviewing") && (
        <button disabled={busy} className="mt-4 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-600" onClick={() => run(() => declineRequest(client, req.id))}>Decline request</button>
      )}
      {!isArtist && !["converted", "cancelled", "declined"].includes(req.status) && (
        <button disabled={busy} className="mt-4 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-600" onClick={() => run(() => cancelRequest(client, req.id))}>Cancel request</button>
      )}
    </main>
  );
}

function OfferCard({ offer, isArtist, busy, onAccept, onDecline, onWithdraw }: {
  offer: OfferView; isArtist: boolean; busy: boolean; onAccept: () => void; onDecline: () => void; onWithdraw: () => void;
}) {
  const pending = offer.status === "pending";
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold">{money(offer.priceAmount, offer.currencyCode)}</span>
        {!pending && <span className="text-xs font-semibold text-zinc-500">{offer.status}</span>}
      </div>
      {offer.proposedStart && <p className="text-sm text-zinc-600">🗓 {fmtDateTime(offer.proposedStart)}</p>}
      {offer.depositAmount != null && <p className="text-sm text-zinc-600">💳 {money(offer.depositAmount, offer.currencyCode)} deposit</p>}
      {offer.message && <p className="mt-1 text-sm italic text-zinc-600">{offer.message}</p>}
      {pending && !isArtist && (
        <div className="mt-3 flex gap-2">
          <button disabled={busy} className="rounded-lg bg-[#E5484D] px-4 py-2 font-semibold text-white" onClick={onAccept}>Accept</button>
          <button disabled={busy} className="rounded-lg border px-4 py-2 font-semibold" onClick={onDecline}>Decline</button>
        </div>
      )}
      {pending && isArtist && <button disabled={busy} className="mt-3 rounded-lg border px-4 py-2 text-sm font-semibold" onClick={onWithdraw}>Withdraw</button>}
    </div>
  );
}

function OfferComposer({ requestId }: { requestId: string }) {
  const client = getSupabaseBrowser();
  const qc = useQueryClient();
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(120);
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!start || !price) { alert("Add a time and price."); return; }
    setBusy(true);
    try {
      const startIso = new Date(start).toISOString();
      const endIso = new Date(new Date(start).getTime() + duration * 60000).toISOString();
      await createOffer(client, {
        requestId: requestId as AppointmentRequestView["id"],
        proposedStart: startIso, proposedEnd: endIso,
        priceAmount: Number(price), depositAmount: deposit ? Number(deposit) : null, message: message || null,
      });
      await qc.invalidateQueries({ queryKey: bookingKeys.request(requestId) });
      setStart(""); setPrice(""); setDeposit(""); setMessage("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-2 rounded-xl border p-4">
      <h2 className="font-bold">Send an offer</h2>
      <label className="block text-sm font-semibold">Proposed time
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block text-sm font-semibold">Duration
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 block w-full rounded-lg border px-3 py-2">
          <option value={60}>1 hour</option><option value={120}>2 hours</option><option value={180}>3 hours</option><option value={360}>Full day</option>
        </select>
      </label>
      <div className="flex gap-2">
        <input placeholder="Price €" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        <input placeholder="Deposit €" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </div>
      <textarea placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} className="block w-full rounded-lg border px-3 py-2" />
      <button disabled={busy} className="rounded-lg bg-[#E5484D] px-4 py-2 font-semibold text-white" onClick={send}>{busy ? "Sending…" : "Send offer"}</button>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600">{children}</span>;
}
